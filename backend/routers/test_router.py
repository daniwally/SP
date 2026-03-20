from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import httpx
import json
import asyncio
from collections import defaultdict
import os

router = APIRouter()

ART = timezone(timedelta(hours=-3))

CUENTAS = {
    1: (2389178513, "SHAQ"),
    2: (2339108379, "STARTER"),
    3: (231953468, "HYDRATE"),
    4: (1434057904, "TIMBERLAND"),
    5: (1630806191, "URBAN_FLOW"),
}

CUENTA_NAMES = {
    1: "cuenta1",
    2: "cuenta2",
    3: "cuenta3",
    4: "cuenta4",
    5: "cuenta5",
}

# ✅ REFRESH_TOKENS (válidos 6 meses) - 15/03/2026
REFRESH_TOKENS = {
    1: "TG-69b69f428dd1340001ad993d-2389178513",
    2: "TG-69b69f4247245b00016c6f22-2339108379",
    3: "TG-69b69f43f4cf8200013075bb-231953468",
    4: "TG-69b69f4386049a000185b420-1434057904",
    5: "TG-69b69f43c3ae1b00019ffc91-1630806191",
}

# ✅ TOKENS HARDCODEADOS FRESHCOS (15/03/2026 ~ vencen 14/03/2027)
TOKENS_HARDCODED = {
    1: "APP_USR-7660452352870630-031400-50a338ae07bd2731123c716b20fa2269-2389178513",
    2: "APP_USR-7660452352870630-031400-8e3e08784d7d3c2a8ede4d6fed821db5-2339108379",
    3: "APP_USR-7660452352870630-031323-ad0383c9d33588f095546dff4059d22e-231953468",
    4: "APP_USR-7660452352870630-031400-f5bdd3f7cffbef04777fd2e48891fda0-1434057904",
    5: "APP_USR-7660452352870630-031400-a00b56f29940c93ae2d3c0d164761155-1630806191",
}

def get_token_hardcoded(cuenta_num):
    return TOKENS_HARDCODED.get(cuenta_num)

# Cache de access_tokens con timestamp
TOKEN_CACHE = {}
APP_ID = "7660452352870630"
APP_SECRET = "QEXEvr8roSZSrK0ujdccsADSqjjrgOpq"

async def get_token(cuenta_num, force_refresh=False):
    """Obtiene access_token: desde cache -> refresh_token -> hardcoded fallback (ASYNC)"""

    # Check cache
    if cuenta_num in TOKEN_CACHE and not force_refresh:
        cached = TOKEN_CACHE[cuenta_num]
        expires_at = cached.get("expires_at", 0)
        if datetime.now(ART).timestamp() < expires_at:
            print(f"✅ Token {cuenta_num}: FROM CACHE (valid until {cached['expires_str']})")
            return cached["token"]

    # Try regenerar con refresh_token
    refresh_token = REFRESH_TOKENS.get(cuenta_num)
    if refresh_token:
        try:
            url = "https://api.mercadolibre.com/oauth/token"
            data = {
                "grant_type": "refresh_token",
                "client_id": APP_ID,
                "client_secret": APP_SECRET,
                "refresh_token": refresh_token,
            }

            async with httpx.AsyncClient() as client:
                resp = await client.post(url, data=data, timeout=10)
                resp.raise_for_status()
                token_data = resp.json()

            access_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 21600)
            expires_at = datetime.now(ART).timestamp() + expires_in - 300
            expires_str = datetime.fromtimestamp(expires_at, ART).strftime("%H:%M ART")

            TOKEN_CACHE[cuenta_num] = {
                "token": access_token,
                "expires_at": expires_at,
                "expires_str": expires_str
            }

            print(f"✅ Token {cuenta_num}: REGENERATED (valid until {expires_str})")
            return access_token

        except Exception as e:
            print(f"⚠️ Token {cuenta_num}: Refresh failed - {e}, usando hardcoded")
            return get_token_hardcoded(cuenta_num)

    return get_token_hardcoded(cuenta_num)


async def api_call(url, token):
    """Llamada async a API de ML"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        print(f"ML API Error: {e}")
        return None


async def refresh_all_tokens():
    """Fuerza regeneración de todos los access_tokens en paralelo"""
    async def refresh_one(cuenta_num):
        token = await get_token(cuenta_num, force_refresh=True)
        marca = CUENTAS[cuenta_num][1]
        return marca, {
            "status": "✅ refreshed" if token else "❌ failed",
            "token": token[:50] + "..." if token else None
        }

    results = await asyncio.gather(*[refresh_one(cn) for cn in CUENTAS.keys()])
    return {marca: data for marca, data in results}


@router.get("/refresh-tokens")
async def refresh_tokens_endpoint():
    """Regenera todos los access_tokens usando refresh_tokens"""
    return await refresh_all_tokens()


@router.get("/precios-actuales")
async def precios_actuales():
    """Precios actuales de ML (última orden por marca) - ASYNC PARALELO"""

    async def fetch_precio(cuenta_num, uid, marca):
        token = await get_token(cuenta_num)
        if not token:
            return marca, {"precio": 0, "fecha": "N/A"}
        try:
            url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc&limit=1"
            data = await api_call(url, token)
            if data and "results" in data and data["results"]:
                orden = data["results"][0]
                return marca, {"precio": orden.get("total_amount", 0), "fecha": orden.get("date_created", "")[:10]}
            return marca, {"precio": 0, "fecha": "N/A"}
        except Exception as e:
            return marca, {"precio": 0, "fecha": f"Error: {str(e)[:30]}"}

    results = await asyncio.gather(*[fetch_precio(cn, uid, marca) for cn, (uid, marca) in CUENTAS.items()])
    return {marca: data for marca, data in results}


@router.get("/ventas-detallado")
async def ventas_detallado():
    """Panel de TEST: Análisis detallado de ventas por período - ASYNC PARALELO"""

    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    HACE_7 = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")
    HACE_30 = (NOW - timedelta(days=30)).strftime("%Y-%m-%d")
    ENERO_ACTUAL = datetime(NOW.year, 1, 1).strftime("%Y-%m-%d")

    async def fetch_cuenta(cuenta_num, uid, marca):
        token = await get_token(cuenta_num)
        if not token:
            return marca, {"error": "Token not found"}

        try:
            # Traer órdenes con paginación async
            ordenes = []
            url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc"

            async with httpx.AsyncClient() as client:
                while True:
                    resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
                    resp.raise_for_status()
                    data = resp.json()

                    if not data or "results" not in data:
                        break

                    batch = data.get("results", [])
                    ordenes.extend(batch)

                    scroll_id = data.get("paging", {}).get("scroll_id")
                    if not scroll_id or len(batch) < 50:
                        break

                    url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc&scroll_id={scroll_id}"

            ordenes_hoy = [o for o in ordenes if o.get("date_created", "")[:10] == HOY]
            ordenes_7d = [o for o in ordenes if HACE_7 <= o.get("date_created", "")[:10] <= HOY]
            ordenes_30d = [o for o in ordenes if HACE_30 <= o.get("date_created", "")[:10] <= HOY]
            ordenes_año = [o for o in ordenes if ENERO_ACTUAL <= o.get("date_created", "")[:10] <= HOY]

            return marca, {
                "hoy": {
                    "total": sum(o.get("total_amount", 0) for o in ordenes_hoy),
                    "ordenes": len(ordenes_hoy),
                    "promedio": sum(o.get("total_amount", 0) for o in ordenes_hoy) / len(ordenes_hoy) if ordenes_hoy else 0
                },
                "semana": {
                    "total": sum(o.get("total_amount", 0) for o in ordenes_7d),
                    "ordenes": len(ordenes_7d),
                    "promedio": sum(o.get("total_amount", 0) for o in ordenes_7d) / len(ordenes_7d) if ordenes_7d else 0
                },
                "mes": {
                    "total": sum(o.get("total_amount", 0) for o in ordenes_30d),
                    "ordenes": len(ordenes_30d),
                    "promedio": sum(o.get("total_amount", 0) for o in ordenes_30d) / len(ordenes_30d) if ordenes_30d else 0
                },
                "año": {
                    "total": sum(o.get("total_amount", 0) for o in ordenes_año),
                    "ordenes": len(ordenes_año),
                    "promedio": sum(o.get("total_amount", 0) for o in ordenes_año) / len(ordenes_año) if ordenes_año else 0
                }
            }

        except Exception as e:
            return marca, {"error": str(e)}

    # Fetch todas las cuentas en paralelo
    results = await asyncio.gather(*[fetch_cuenta(cn, uid, marca) for cn, (uid, marca) in CUENTAS.items()])

    resultado = {"hoy": {}, "semana": {}, "mes": {}, "año": {},
                 "debug": {"fecha_hoy": HOY, "rango_7d": f"{HACE_7} a {HOY}", "rango_30d": f"{HACE_30} a {HOY}", "rango_año": f"{ENERO_ACTUAL} a {HOY}"}}

    for marca, data in results:
        if "error" in data:
            resultado["hoy"][marca] = data
        else:
            resultado["hoy"][marca] = data["hoy"]
            resultado["semana"][marca] = data["semana"]
            resultado["mes"][marca] = data["mes"]
            resultado["año"][marca] = data["año"]

    # TOTALES CONSOLIDADOS
    for periodo in ["hoy", "semana", "mes", "año"]:
        vals = resultado[periodo].values()
        resultado.setdefault("totales", {})[periodo] = {
            "total": sum(v.get("total", 0) for v in vals if "total" in v),
            "ordenes": sum(v.get("ordenes", 0) for v in vals if "ordenes" in v)
        }

    return resultado
