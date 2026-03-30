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

    def fecha_art(date_str):
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.astimezone(ART).strftime("%Y-%m-%d")
        except Exception:
            return date_str[:10]

    async def fetch_cuenta(cuenta_num, uid, marca):
        token = await get_token(cuenta_num)
        if not token:
            return marca, {"error": "Token not found"}, {}

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

            # Agrupar por día para el gráfico
            por_dia = defaultdict(lambda: {"total": 0, "ordenes": 0})
            # Agrupar por categoría
            categorias = defaultdict(lambda: {"total": 0, "cantidad": 0})
            for o in ordenes:
                dia = fecha_art(o.get("date_created", ""))
                por_dia[dia]["total"] += o.get("total_amount", 0)
                por_dia[dia]["ordenes"] += 1
                for item in o.get("order_items", []):
                    cat_id = item.get("item", {}).get("category_id")
                    if cat_id:
                        qty = item.get("quantity", 1)
                        unit_price = item.get("unit_price", 0)
                        categorias[cat_id]["cantidad"] += qty
                        categorias[cat_id]["total"] += unit_price * qty

            return marca, {
                "total": sum(o.get("total_amount", 0) for o in ordenes),
                "ordenes": len(ordenes),
                "productos": extract_sku_productos(ordenes)[:10]
            }, dict(por_dia), dict(categorias)

        except Exception as e:
            return marca, {"error": str(e)}, {}, {}

    results = await asyncio.gather(*[fetch_cuenta(cn, uid, marca) for cn, (uid, marca) in CUENTAS.items()])

    resultado = {}
    diario_por_marca = {}
    categorias_global = defaultdict(lambda: {"total": 0, "cantidad": 0})
    for marca, data, diario, cats in results:
        resultado[marca] = data
        if diario:
            diario_por_marca[marca] = diario
        for cat_id, vals in cats.items():
            categorias_global[cat_id]["total"] += vals["total"]
            categorias_global[cat_id]["cantidad"] += vals["cantidad"]

    total_general = sum(v.get("total", 0) for v in resultado.values() if "total" in v)
    ordenes_general = sum(v.get("ordenes", 0) for v in resultado.values() if "ordenes" in v)
    resultado["totales"] = {"total": total_general, "ordenes": ordenes_general}

    # Generar lista de días del rango
    d_start = datetime.strptime(desde, "%Y-%m-%d")
    d_end = datetime.strptime(hasta, "%Y-%m-%d")
    dias = []
    d = d_start
    while d <= d_end:
        dias.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)

    marcas_diario = {}
    for marca, data in diario_por_marca.items():
        marcas_diario[marca] = [
            {"fecha": dia, "total": data.get(dia, {}).get("total", 0), "ordenes": data.get(dia, {}).get("ordenes", 0)}
            for dia in dias
        ]

    resultado["diario"] = {"dias": dias, "marcas": marcas_diario}

    # Resolver nombres de categorías (top 10)
    top_cats = sorted(categorias_global.items(), key=lambda x: x[1]["cantidad"], reverse=True)[:10]
    if top_cats:
        cat_names = {}
        cat_paths = {}
        async with httpx.AsyncClient(timeout=10) as client:
            cat_tasks = []
            for cat_id, _ in top_cats:
                cat_tasks.append(client.get(f"https://api.mercadolibre.com/categories/{cat_id}"))
            cat_responses = await asyncio.gather(*cat_tasks, return_exceptions=True)
            for i, resp in enumerate(cat_responses):
                cat_id = top_cats[i][0]
                if isinstance(resp, Exception):
                    cat_names[cat_id] = cat_id
                    cat_paths[cat_id] = cat_id
                elif resp.status_code == 200:
                    cdata = resp.json()
                    cat_names[cat_id] = cdata.get("name", cat_id)
                    path_from_root = cdata.get("path_from_root", [])
                    cat_paths[cat_id] = " > ".join(p.get("name", "") for p in path_from_root) if path_from_root else cat_names[cat_id]
                else:
                    cat_names[cat_id] = cat_id
                    cat_paths[cat_id] = cat_id

        resultado["categorias"] = [
            {"id": cat_id, "nombre": cat_names.get(cat_id, cat_id), "path": cat_paths.get(cat_id, cat_id), "cantidad": vals["cantidad"], "total": round(vals["total"])}
            for cat_id, vals in top_cats
        ]
    else:
        resultado["categorias"] = []

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


@router.get("/envios")
async def envios_resumen():
    """Resumen de envíos: hoy, semana y mes — con detalle de estado por marca"""
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    HACE_7 = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")
    INICIO_MES = datetime(NOW.year, NOW.month, 1).strftime("%Y-%m-%d")

    def fecha_art(date_str):
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt.astimezone(ART).strftime("%Y-%m-%d")
        except Exception:
            return date_str[:10]

    async def fetch_envios_cuenta(cuenta_num, uid, marca):
        token = await get_token(cuenta_num)
        if not token:
            return marca, {"error": "Token not found"}

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

            # Extraer shipping ids y contar por estado
            def get_envios_stats(lista_ordenes):
                shipping_ids = []
                for o in lista_ordenes:
                    sid = o.get("shipping", {}).get("id")
                    if sid:
                        shipping_ids.append(sid)
                return {"envios": len(shipping_ids)}

            ordenes_hoy = [o for o in ordenes if fecha_art(o.get("date_created", "")) == HOY]
            ordenes_7d = [o for o in ordenes if HACE_7 <= fecha_art(o.get("date_created", "")) <= HOY]

            return marca, {
                "hoy": get_envios_stats(ordenes_hoy),
                "semana": get_envios_stats(ordenes_7d),
                "mes": get_envios_stats(ordenes),
            }
        except Exception as e:
            print(f"Error envios {marca}: {e}")
            return marca, {"error": str(e)[:100]}

    results = await asyncio.gather(*[fetch_envios_cuenta(cn, uid, marca) for cn, (uid, marca) in CUENTAS.items()])
    return {marca: data for marca, data in results}


@router.get("/envios-detalle")
async def envios_detalle(desde: str, hasta: str):
    """Lista detallada de envíos por rango con estado, dirección y tracking"""
    date_from = f"{desde}T00:00:00.000-03:00"
    date_to = f"{hasta}T23:59:59.999-03:00"

    async def fetch_cuenta(cuenta_num, uid, marca):
        token = await get_token(cuenta_num)
        if not token:
            return marca, []

        try:
            ordenes = []
            base_url = (
                f"https://api.mercadolibre.com/orders/search"
                f"?seller={uid}&sort=date_desc"
                f"&order.date_created.from={date_from}"
                f"&order.date_created.to={date_to}"
            )
            url = base_url

            async with httpx.AsyncClient(timeout=15) as client:
                while True:
                    resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
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

                # Para cada orden con shipping, obtener detalle del envío
                shipping_ids = []
                order_map = {}
                for o in ordenes:
                    sid = o.get("shipping", {}).get("id")
                    if sid:
                        shipping_ids.append(sid)
                        order_map[sid] = o

                # Fetch shipment details in batches (max 20 concurrent)
                envios = []
                batch_size = 20
                for i in range(0, len(shipping_ids), batch_size):
                    batch_ids = shipping_ids[i:i + batch_size]
                    tasks = []
                    for sid in batch_ids:
                        tasks.append(client.get(
                            f"https://api.mercadolibre.com/shipments/{sid}",
                            headers={"Authorization": f"Bearer {token}", "x-format-new": "true"},
                            timeout=10
                        ))
                    responses = await asyncio.gather(*tasks, return_exceptions=True)
                    for j, resp in enumerate(responses):
                        sid = batch_ids[j]
                        orden = order_map.get(sid, {})
                        if isinstance(resp, Exception):
                            envios.append({
                                "shipping_id": sid,
                                "marca": marca,
                                "fecha": orden.get("date_created", "")[:10],
                                "monto": orden.get("total_amount", 0),
                                "status": "unknown",
                                "ciudad": None,
                                "provincia": None,
                                "cp": None,
                            })
                        elif resp.status_code == 200:
                            ship = resp.json()
                            receiver = ship.get("receiver_address") or ship.get("destination", {}).get("shipping_address", {}) or {}
                            status_detail = ship.get("status", "unknown")
                            substatus = ship.get("substatus", "")
                            envios.append({
                                "shipping_id": sid,
                                "marca": marca,
                                "fecha": orden.get("date_created", "")[:10],
                                "monto": orden.get("total_amount", 0),
                                "status": status_detail,
                                "substatus": substatus,
                                "ciudad": receiver.get("city", {}).get("name") if isinstance(receiver.get("city"), dict) else receiver.get("city"),
                                "provincia": receiver.get("state", {}).get("name") if isinstance(receiver.get("state"), dict) else receiver.get("state"),
                                "cp": receiver.get("zip_code"),
                                "producto": orden.get("order_items", [{}])[0].get("item", {}).get("title", "") if orden.get("order_items") else "",
                            })
                        else:
                            envios.append({
                                "shipping_id": sid,
                                "marca": marca,
                                "fecha": orden.get("date_created", "")[:10],
                                "monto": orden.get("total_amount", 0),
                                "status": "error",
                                "ciudad": None,
                                "provincia": None,
                                "cp": None,
                            })

            return marca, envios
        except Exception as e:
            print(f"Error envios-detalle {marca}: {e}")
            return marca, []

    results = await asyncio.gather(*[fetch_cuenta(cn, uid, marca) for cn, (uid, marca) in CUENTAS.items()])

    all_envios = []
    por_marca = {}
    for marca, envios in results:
        por_marca[marca] = len(envios)
        all_envios.extend(envios)

    # Ordenar por fecha desc
    all_envios.sort(key=lambda x: x.get("fecha", ""), reverse=True)

    # Stats por provincia
    por_provincia = defaultdict(int)
    for e in all_envios:
        prov = e.get("provincia") or "Desconocida"
        por_provincia[prov] += 1

    # Stats por estado
    por_estado = defaultdict(int)
    for e in all_envios:
        por_estado[e.get("status", "unknown")] += 1

    return {
        "total": len(all_envios),
        "por_marca": por_marca,
        "por_estado": dict(por_estado),
        "por_provincia": dict(sorted(por_provincia.items(), key=lambda x: x[1], reverse=True)),
        "envios": all_envios,
    }

    # Geocodificar localidades para heatmap
    localidades = defaultdict(int)
    for e in all_envios:
        ciudad = e.get("ciudad")
        provincia = e.get("provincia")
        if ciudad and provincia:
            localidades[(ciudad, provincia)] += 1

    heatmap_points = await geocode_localidades(localidades)
    resultado["heatmap"] = heatmap_points

    return resultado


# Cache global de geocoding — persiste mientras el server esté vivo
_geocode_cache = {}


async def geocode_localidades(localidades: dict) -> list:
    """Geocodifica localidades únicas vía Nominatim y devuelve puntos para heatmap.
    localidades: {(ciudad, provincia): cantidad}
    """
    points = []
    to_resolve = []

    for (ciudad, provincia), cantidad in localidades.items():
        key = f"{ciudad}|{provincia}"
        if key in _geocode_cache:
            cached = _geocode_cache[key]
            if cached:
                points.append({"lat": cached[0], "lng": cached[1], "cantidad": cantidad, "ciudad": ciudad, "provincia": provincia})
        else:
            to_resolve.append((ciudad, provincia, cantidad))

    # Geocodificar los que faltan — 1 req/sec para respetar Nominatim
    if to_resolve:
        async with httpx.AsyncClient(timeout=10) as client:
            for ciudad, provincia, cantidad in to_resolve:
                key = f"{ciudad}|{provincia}"
                try:
                    resp = await client.get(
                        "https://nominatim.openstreetmap.org/search",
                        params={"city": ciudad, "state": provincia, "country": "Argentina", "format": "json", "limit": 1},
                        headers={"User-Agent": "ONEMANDO-Dashboard/1.0"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data:
                            lat = float(data[0]["lat"])
                            lng = float(data[0]["lon"])
                            _geocode_cache[key] = (lat, lng)
                            points.append({"lat": lat, "lng": lng, "cantidad": cantidad, "ciudad": ciudad, "provincia": provincia})
                        else:
                            _geocode_cache[key] = None
                    else:
                        _geocode_cache[key] = None
                except Exception:
                    _geocode_cache[key] = None
                # Respetar rate limit de Nominatim
                await asyncio.sleep(0.3)

    return points
