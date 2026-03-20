from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import httpx
import json
import asyncio
from collections import defaultdict
import os
import re
from routers.token_manager import get_token, CUENTAS


def extract_sku_productos(ordenes):
    """Extrae productos con SKU y nombre de las órdenes, agrupados por cantidad"""
    productos_dict = {}  # key: (sku, nombre) -> cantidad
    for orden in ordenes:
        try:
            for item in orden.get("order_items", []):
                item_data = item.get("item", {})
                sku = item_data.get("seller_sku") or item_data.get("id", "")
                nombre = item_data.get("title", "Producto desconocido")
                cantidad = item.get("quantity", 1)
                key = (str(sku), nombre)
                productos_dict[key] = productos_dict.get(key, 0) + cantidad
        except Exception:
            pass

    return sorted(
        [{"sku": k[0], "nombre": k[1], "cantidad": v} for k, v in productos_dict.items()],
        key=lambda x: x["cantidad"], reverse=True
    )

router = APIRouter()

ART = timezone(timedelta(hours=-3))


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
                    "promedio": sum(o.get("total_amount", 0) for o in ordenes_hoy) / len(ordenes_hoy) if ordenes_hoy else 0,
                    "productos": extract_sku_productos(ordenes_hoy)[:10]
                },
                "semana": {
                    "total": sum(o.get("total_amount", 0) for o in ordenes_7d),
                    "ordenes": len(ordenes_7d),
                    "promedio": sum(o.get("total_amount", 0) for o in ordenes_7d) / len(ordenes_7d) if ordenes_7d else 0,
                    "productos": extract_sku_productos(ordenes_7d)[:10]
                },
                "mes": {
                    "total": sum(o.get("total_amount", 0) for o in ordenes_30d),
                    "ordenes": len(ordenes_30d),
                    "promedio": sum(o.get("total_amount", 0) for o in ordenes_30d) / len(ordenes_30d) if ordenes_30d else 0,
                    "productos": extract_sku_productos(ordenes_30d)[:10]
                },
                "año": {
                    "total": sum(o.get("total_amount", 0) for o in ordenes_año),
                    "ordenes": len(ordenes_año),
                    "promedio": sum(o.get("total_amount", 0) for o in ordenes_año) / len(ordenes_año) if ordenes_año else 0,
                    "productos": extract_sku_productos(ordenes_año)[:10]
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
