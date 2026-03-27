from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import httpx
import json
import asyncio
from collections import defaultdict
import os
import re
from routers.token_manager import get_token, CUENTAS
from routers.ml_router import clean_product_name


def extract_sku_productos(ordenes):
    """Extrae productos con SKU y nombre de las órdenes, agrupados por cantidad"""
    productos_dict = {}  # key: nombre_limpio -> cantidad
    for orden in ordenes:
        try:
            for item in orden.get("order_items", []):
                item_data = item.get("item", {})
                nombre_raw = item_data.get("title", "Producto desconocido")
                nombre = clean_product_name(nombre_raw)
                cantidad = item.get("quantity", 1)
                productos_dict[nombre] = productos_dict.get(nombre, 0) + cantidad
        except Exception:
            pass

    return sorted(
        [{"nombre": k, "cantidad": v} for k, v in productos_dict.items()],
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
    INICIO_MES = datetime(NOW.year, NOW.month, 1).strftime("%Y-%m-%d")
    ENERO_ACTUAL = datetime(NOW.year, 1, 1).strftime("%Y-%m-%d")

    async def fetch_cuenta(cuenta_num, uid, marca):
        token = await get_token(cuenta_num)
        if not token:
            return marca, {"error": "Token not found"}

        try:
            # Traer órdenes desde inicio de mes con paginación async
            ordenes = []
            date_from = f"{INICIO_MES}T00:00:00.000-03:00"
            date_to = f"{HOY}T23:59:59.999-03:00"
            base_url = (
                f"https://api.mercadolibre.com/orders/search"
                f"?seller={uid}&sort=date_desc"
                f"&order.date_created.from={date_from}"
                f"&order.date_created.to={date_to}"
            )
            url = base_url

            async with httpx.AsyncClient() as client:
                while True:
                    resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
                    resp.raise_for_status()
                    data = resp.json()

                    if not data or "results" not in data:
                        break

                    batch = data.get("results", [])
                    ordenes.extend(batch)

                    # Use offset pagination
                    paging = data.get("paging", {})
                    offset = paging.get("offset", 0)
                    limit = paging.get("limit", 50)
                    total = paging.get("total", 0)
                    if offset + limit >= total:
                        break
                    url = f"{base_url}&offset={offset + limit}"

            # Filtrar órdenes válidas (pagadas o confirmadas, excluir canceladas)
            ordenes = [o for o in ordenes if o.get("status") != "cancelled"]

            # Convertir date_created a fecha ART para comparar correctamente
            def fecha_art(date_str):
                """Extrae fecha en ART de un ISO datetime string de MeLi"""
                try:
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    return dt.astimezone(ART).strftime("%Y-%m-%d")
                except Exception:
                    return date_str[:10]

            ordenes_hoy = [o for o in ordenes if fecha_art(o.get("date_created", "")) == HOY]
            ordenes_7d = [o for o in ordenes if HACE_7 <= fecha_art(o.get("date_created", "")) <= HOY]
            ordenes_mes = ordenes  # Already filtered by date_from/date_to in API call

            print(f"📦 {marca}: {len(ordenes)} órdenes mes, {len(ordenes_hoy)} hoy ({HOY})")

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
                    "total": sum(o.get("total_amount", 0) for o in ordenes_mes),
                    "ordenes": len(ordenes_mes),
                    "promedio": sum(o.get("total_amount", 0) for o in ordenes_mes) / len(ordenes_mes) if ordenes_mes else 0,
                    "productos": extract_sku_productos(ordenes_mes)[:10]
                },
                "año": {
                    "total": sum(o.get("total_amount", 0) for o in ordenes_mes),
                    "ordenes": len(ordenes_mes),
                }
            }

        except Exception as e:
            return marca, {"error": str(e)}

    # Fetch todas las cuentas en paralelo
    results = await asyncio.gather(*[fetch_cuenta(cn, uid, marca) for cn, (uid, marca) in CUENTAS.items()])

    resultado = {"hoy": {}, "semana": {}, "mes": {}, "año": {},
                 "debug": {"fecha_hoy": HOY, "rango_7d": f"{HACE_7} a {HOY}", "rango_mes": f"{INICIO_MES} a {HOY}", "rango_año": f"{ENERO_ACTUAL} a {HOY}"}}

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


@router.get("/ventas-rango")
async def ventas_rango(desde: str, hasta: str):
    """Ventas por rango de fechas personalizado - ASYNC PARALELO"""
    date_from = f"{desde}T00:00:00.000-03:00"
    date_to = f"{hasta}T23:59:59.999-03:00"

    async def fetch_cuenta(cuenta_num, uid, marca):
        token = await get_token(cuenta_num)
        if not token:
            return marca, {"error": "Token not found"}

        try:
            ordenes = []
            base_url = (
                f"https://api.mercadolibre.com/orders/search"
                f"?seller={uid}&sort=date_desc"
                f"&order.date_created.from={date_from}"
                f"&order.date_created.to={date_to}"
            )
            url = base_url

            async with httpx.AsyncClient() as client:
                while True:
                    resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
                    resp.raise_for_status()
                    data = resp.json()

                    if not data or "results" not in data:
                        break

                    batch = data.get("results", [])
                    ordenes.extend(batch)

                    paging = data.get("paging", {})
                    offset = paging.get("offset", 0)
                    limit = paging.get("limit", 50)
                    total = paging.get("total", 0)
                    if offset + limit >= total:
                        break
                    url = f"{base_url}&offset={offset + limit}"

            ordenes = [o for o in ordenes if o.get("status") != "cancelled"]

            return marca, {
                "total": sum(o.get("total_amount", 0) for o in ordenes),
                "ordenes": len(ordenes),
                "productos": extract_sku_productos(ordenes)[:10]
            }

        except Exception as e:
            return marca, {"error": str(e)}

    results = await asyncio.gather(*[fetch_cuenta(cn, uid, marca) for cn, (uid, marca) in CUENTAS.items()])

    resultado = {}
    for marca, data in results:
        resultado[marca] = data

    total_general = sum(v.get("total", 0) for v in resultado.values() if "total" in v)
    ordenes_general = sum(v.get("ordenes", 0) for v in resultado.values() if "ordenes" in v)
    resultado["totales"] = {"total": total_general, "ordenes": ordenes_general}

    return resultado


@router.get("/ventas-diarias")
async def ventas_diarias():
    """Ventas diarias del mes actual agrupadas por marca — para gráfico de líneas"""
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    INICIO_MES = datetime(NOW.year, NOW.month, 1).strftime("%Y-%m-%d")

    def fecha_art(date_str):
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.astimezone(ART).strftime("%Y-%m-%d")
        except Exception:
            return date_str[:10]

    async def fetch_cuenta(cuenta_num, uid, marca):
        token = await get_token(cuenta_num)
        if not token:
            return marca, {}

        try:
            ordenes = []
            date_from = f"{INICIO_MES}T00:00:00.000-03:00"
            date_to = f"{HOY}T23:59:59.999-03:00"
            base_url = (
                f"https://api.mercadolibre.com/orders/search"
                f"?seller={uid}&sort=date_desc"
                f"&order.date_created.from={date_from}"
                f"&order.date_created.to={date_to}"
            )
            url = base_url

            async with httpx.AsyncClient() as client:
                while True:
                    resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
                    resp.raise_for_status()
                    data = resp.json()
                    if not data or "results" not in data:
                        break
                    batch = data.get("results", [])
                    ordenes.extend(batch)
                    paging = data.get("paging", {})
                    offset = paging.get("offset", 0)
                    limit = paging.get("limit", 50)
                    total = paging.get("total", 0)
                    if offset + limit >= total:
                        break
                    url = f"{base_url}&offset={offset + limit}"

            ordenes = [o for o in ordenes if o.get("status") != "cancelled"]

            # Agrupar por día
            por_dia = defaultdict(lambda: {"total": 0, "ordenes": 0})
            for o in ordenes:
                dia = fecha_art(o.get("date_created", ""))
                por_dia[dia]["total"] += o.get("total_amount", 0)
                por_dia[dia]["ordenes"] += 1

            return marca, dict(por_dia)
        except Exception as e:
            print(f"Error ventas-diarias {marca}: {e}")
            return marca, {}

    results = await asyncio.gather(*[fetch_cuenta(cn, uid, marca) for cn, (uid, marca) in CUENTAS.items()])

    # Generar lista de todos los días del mes
    dias = []
    d = datetime(NOW.year, NOW.month, 1)
    while d.date() <= NOW.date():
        dias.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)

    marcas_data = {}
    for marca, data in results:
        marcas_data[marca] = [
            {"fecha": dia, "total": data.get(dia, {}).get("total", 0), "ordenes": data.get(dia, {}).get("ordenes", 0)}
            for dia in dias
        ]

    return {"dias": dias, "marcas": marcas_data}
