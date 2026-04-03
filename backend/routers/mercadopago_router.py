"""
MercadoPago API router (read-only).
Fetches payments, refunds, chargebacks per brand account.
Uses the same ML tokens from token_manager.
"""
from fastapi import APIRouter, Query
from datetime import datetime, timedelta, timezone
import httpx
import asyncio

from routers.token_manager import CUENTAS, get_token

router = APIRouter()

ART = timezone(timedelta(hours=-3))

MP_BASE = "https://api.mercadopago.com"

BRANDS = {marca: num for num, (uid, marca) in CUENTAS.items()}


async def _get_mp_token(marca: str) -> str | None:
    """Get token for a brand using the existing ML token_manager."""
    cuenta_num = BRANDS.get(marca)
    if cuenta_num is None:
        return None
    return await get_token(cuenta_num)


async def _mp_get(token: str, path: str, params: dict = None) -> dict:
    """Make authenticated GET request to MercadoPago API."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{MP_BASE}{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params or {},
        )
        return resp.json()


async def _fetch_payments(token: str, desde: str, hasta: str) -> dict:
    """Fetch payments for a date range."""
    params = {
        "sort": "date_created",
        "criteria": "desc",
        "begin_date": f"{desde}T00:00:00.000-03:00",
        "end_date": f"{hasta}T23:59:59.000-03:00",
        "limit": 100,
        "offset": 0,
    }

    all_payments = []
    total = 0

    try:
        data = await _mp_get(token, "/v1/payments/search", params)
        total = data.get("paging", {}).get("total", 0)
        all_payments.extend(data.get("results", []))

        # Paginate if more results
        while len(all_payments) < total and len(all_payments) < 500:
            params["offset"] = len(all_payments)
            data = await _mp_get(token, "/v1/payments/search", params)
            results = data.get("results", [])
            if not results:
                break
            all_payments.extend(results)

    except Exception as e:
        print(f"[MP] Error fetching payments: {e}")
        return {"error": str(e), "payments": [], "total": 0}

    # Process payments
    approved = [p for p in all_payments if p.get("status") == "approved"]
    pending = [p for p in all_payments if p.get("status") == "pending"]
    rejected = [p for p in all_payments if p.get("status") == "rejected"]
    refunded = [p for p in all_payments if p.get("status") == "refunded"]

    total_approved = sum(p.get("transaction_amount", 0) for p in approved)
    total_pending = sum(p.get("transaction_amount", 0) for p in pending)
    total_rejected = sum(p.get("transaction_amount", 0) for p in rejected)
    total_refunded = sum(p.get("transaction_amount", 0) for p in refunded)
    total_fees = sum(p.get("fee_details", [{}])[0].get("amount", 0) if p.get("fee_details") else 0 for p in approved)
    total_net = total_approved - total_fees

    # Por cobrar: approved payments where money is not yet released
    por_cobrar = [p for p in approved if p.get("money_release_status") != "released"]
    total_por_cobrar = sum(p.get("transaction_amount", 0) for p in por_cobrar)
    # Liberado: already released
    liberado = [p for p in approved if p.get("money_release_status") == "released"]
    total_liberado = sum(p.get("transaction_amount", 0) for p in liberado)

    # Payment methods breakdown
    methods = {}
    for p in approved:
        pm = p.get("payment_type_id", "otro")
        methods[pm] = methods.get(pm, 0) + 1

    # Daily breakdown
    daily = {}
    for p in approved:
        day = (p.get("date_created") or "")[:10]
        if day:
            if day not in daily:
                daily[day] = {"monto": 0, "count": 0}
            daily[day]["monto"] += p.get("transaction_amount", 0)
            daily[day]["count"] += 1

    return {
        "total": len(all_payments),
        "approved": {
            "count": len(approved),
            "amount": round(total_approved, 2),
        },
        "pending": {
            "count": len(pending),
            "amount": round(total_pending, 2),
        },
        "rejected": {
            "count": len(rejected),
            "amount": round(total_rejected, 2),
        },
        "refunded": {
            "count": len(refunded),
            "amount": round(total_refunded, 2),
        },
        "fees": round(total_fees, 2),
        "net": round(total_net, 2),
        "por_cobrar": {
            "count": len(por_cobrar),
            "amount": round(total_por_cobrar, 2),
        },
        "liberado": {
            "count": len(liberado),
            "amount": round(total_liberado, 2),
        },
        "methods": methods,
        "daily": dict(sorted(daily.items())),
        "payments": [{
            "id": p.get("id"),
            "date": p.get("date_created", "")[:19],
            "amount": p.get("transaction_amount", 0),
            "net": p.get("transaction_net_received_amount", 0),
            "status": p.get("status", ""),
            "status_detail": p.get("status_detail", ""),
            "payment_type": p.get("payment_type_id", ""),
            "payment_method": p.get("payment_method_id", ""),
            "description": p.get("description", ""),
            "payer_email": (p.get("payer") or {}).get("email", ""),
            "external_reference": p.get("external_reference", ""),
        } for p in all_payments[:50]],
    }


async def _fetch_chargebacks(token: str) -> dict:
    """Fetch chargebacks (contracargos)."""
    try:
        data = await _mp_get(token, "/v1/chargebacks", {"limit": 50})
        chargebacks = data.get("results", []) if isinstance(data, dict) else []
        # Sometimes returns a list directly
        if isinstance(data, list):
            chargebacks = data

        return {
            "total": len(chargebacks),
            "chargebacks": [{
                "id": c.get("id"),
                "date": c.get("date_created", ""),
                "amount": c.get("amount", 0),
                "status": c.get("status", ""),
                "reason": c.get("reason_code", ""),
                "payment_id": c.get("payment_id"),
            } for c in chargebacks[:20]],
        }
    except Exception as e:
        print(f"[MP] Error fetching chargebacks: {e}")
        return {"total": 0, "chargebacks": [], "error": str(e)}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/dashboard")
async def mp_dashboard(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    """Dashboard consolidado de todas las cuentas MP."""
    today = datetime.now(ART)
    if not desde:
        desde = today.replace(day=1).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    results = {}
    totals = {
        "approved": 0, "approved_count": 0,
        "pending": 0, "pending_count": 0,
        "rejected": 0, "rejected_count": 0,
        "refunded": 0, "refunded_count": 0,
        "fees": 0, "net": 0,
        "por_cobrar": 0, "por_cobrar_count": 0,
        "liberado": 0, "liberado_count": 0,
        "chargebacks": 0, "chargebacks_count": 0,
    }
    all_methods = {}
    all_daily = {}
    errors = []

    for marca in BRANDS:
        token = await _get_mp_token(marca)
        if not token:
            results[marca] = {"error": "Sin token configurado"}
            errors.append(f"{marca}: sin token")
            continue

        try:
            payments, chargebacks = await asyncio.gather(
                _fetch_payments(token, desde, hasta),
                _fetch_chargebacks(token),
            )

            if payments.get("error"):
                errors.append(f"{marca}: {payments['error']}")

            results[marca] = {
                "payments": payments,
                "chargebacks": chargebacks,
            }

            # Accumulate totals
            totals["approved"] += payments.get("approved", {}).get("amount", 0)
            totals["approved_count"] += payments.get("approved", {}).get("count", 0)
            totals["pending"] += payments.get("pending", {}).get("amount", 0)
            totals["pending_count"] += payments.get("pending", {}).get("count", 0)
            totals["rejected"] += payments.get("rejected", {}).get("amount", 0)
            totals["rejected_count"] += payments.get("rejected", {}).get("count", 0)
            totals["refunded"] += payments.get("refunded", {}).get("amount", 0)
            totals["refunded_count"] += payments.get("refunded", {}).get("count", 0)
            totals["fees"] += payments.get("fees", 0)
            totals["net"] += payments.get("net", 0)
            totals["por_cobrar"] += payments.get("por_cobrar", {}).get("amount", 0)
            totals["por_cobrar_count"] += payments.get("por_cobrar", {}).get("count", 0)
            totals["liberado"] += payments.get("liberado", {}).get("amount", 0)
            totals["liberado_count"] += payments.get("liberado", {}).get("count", 0)
            totals["chargebacks"] += sum(c.get("amount", 0) for c in chargebacks.get("chargebacks", []))
            totals["chargebacks_count"] += chargebacks.get("total", 0)

            # Merge methods
            for method, count in payments.get("methods", {}).items():
                all_methods[method] = all_methods.get(method, 0) + count

            # Merge daily
            for day, data in payments.get("daily", {}).items():
                if day not in all_daily:
                    all_daily[day] = {"monto": 0, "count": 0}
                all_daily[day]["monto"] += data["monto"]
                all_daily[day]["count"] += data["count"]

        except Exception as e:
            print(f"[MP] Error for {marca}: {e}")
            results[marca] = {"error": str(e)}
            errors.append(f"{marca}: {str(e)}")

    # Round totals
    for k in ["approved", "pending", "rejected", "refunded", "fees", "net", "por_cobrar", "liberado", "chargebacks"]:
        totals[k] = round(totals[k], 2)

    response = {
        "periodo": {"desde": desde, "hasta": hasta},
        "totals": totals,
        "methods": all_methods,
        "daily": dict(sorted(all_daily.items())),
        "brands": results,
    }

    if errors:
        response["errors"] = errors

    return response


@router.get("/status")
async def mp_status():
    """Check connection status for all MP accounts."""
    statuses = {}
    for marca in BRANDS:
        token = await _get_mp_token(marca)
        if not token:
            statuses[marca] = {"connected": False, "error": "Sin token"}
            continue
        try:
            data = await _mp_get(token, "/v1/payments/search", {"limit": 1})
            if "error" in data or "message" in data:
                statuses[marca] = {"connected": False, "error": data.get("message", data.get("error", "Unknown"))}
            else:
                statuses[marca] = {"connected": True, "total_payments": data.get("paging", {}).get("total", 0)}
        except Exception as e:
            statuses[marca] = {"connected": False, "error": str(e)}

    return statuses


