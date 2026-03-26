"""
Router para obtener reporte completo de publicaciones desde ML API
Estado, Tipo, Precio, Marca, Stock, Vendidas, Envío, Condición, Health, etc.
ASYNC con httpx + asyncio.gather para fetch paralelo por marca
"""

from fastapi import APIRouter, HTTPException, Query
import httpx
import json
import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from routers.token_manager import get_token_by_marca, CUENTAS

router = APIRouter(prefix="/api/publicaciones", tags=["publicaciones"])

ART = timezone(timedelta(hours=-3))

# Mapeo de marcas a UIDs
MARCAS = {
    "SHAQ": 2389178513,
    "STARTER": 2339108379,
    "HYDRATE": 231953468,
    "TIMBERLAND": 1434057904,
    "URBAN_FLOW": 1630806191,
}

# Mapeo legible de listing types
LISTING_TYPE_LABELS = {
    "gold_special": "Premium (Clásica)",
    "gold_pro": "Premium",
    "gold": "Oro",
    "silver": "Plata",
    "bronze": "Bronce",
    "free": "Gratuita",
}

STATUS_LABELS = {
    "active": "Activa",
    "paused": "Pausada",
    "closed": "Cerrada",
    "under_review": "En revisión",
    "inactive": "Inactiva",
}

CONDITION_LABELS = {
    "new": "Nuevo",
    "used": "Usado",
    "not_specified": "No especificado",
}


async def api_call(url, token, client=None):
    """Llamada async a API de ML"""
    try:
        if client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
            resp.raise_for_status()
            return resp.json()
        async with httpx.AsyncClient() as c:
            resp = await c.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        print(f"ML API Error [{url[:80]}]: {e}")
        return None


async def get_seller_items(uid: int, token: str, status: str = "active") -> List[str]:
    """Obtener IDs de items de un seller con paginación (ASYNC)"""
    all_ids = []
    offset = 0
    limit = 50

    async with httpx.AsyncClient() as client:
        while True:
            url = f"https://api.mercadolibre.com/users/{uid}/items/search?status={status}&offset={offset}&limit={limit}"
            data = await api_call(url, token, client)
            if not data:
                break

            ids = data.get("results", [])
            all_ids.extend(ids)

            total = data.get("paging", {}).get("total", 0)
            offset += limit
            if offset >= total:
                break

    return all_ids


async def get_items_batch(item_ids: List[str], token: str) -> List[Dict]:
    """Obtener detalles de múltiples items usando multi-get (ASYNC PARALELO)"""
    if not item_ids:
        return []

    async def fetch_batch(ids_batch, client):
        ids_str = ",".join(ids_batch)
        url = f"https://api.mercadolibre.com/items?ids={ids_str}"
        data = await api_call(url, token, client)
        items = []
        if data and isinstance(data, list):
            for entry in data:
                if entry.get("code") == 200 and entry.get("body"):
                    items.append(entry["body"])
        return items

    # Fetch all batches in parallel
    async with httpx.AsyncClient() as client:
        batches = [item_ids[i:i + 20] for i in range(0, len(item_ids), 20)]
        results = await asyncio.gather(*[fetch_batch(batch, client) for batch in batches])

    all_items = []
    for items in results:
        all_items.extend(items)
    return all_items


async def get_items_full(item_ids: List[str], token: str) -> List[Dict]:
    """Obtener items individualmente para tener variaciones completas con seller_custom_field"""
    if not item_ids:
        return []

    async def fetch_single(item_id, client):
        url = f"https://api.mercadolibre.com/items/{item_id}"
        return await api_call(url, token, client)

    async with httpx.AsyncClient() as client:
        # Fetch en paralelo, máx 10 concurrentes para no saturar la API
        sem = asyncio.Semaphore(10)
        async def fetch_with_sem(item_id):
            async with sem:
                return await fetch_single(item_id, client)

        results = await asyncio.gather(*[fetch_with_sem(iid) for iid in item_ids])

    return [r for r in results if r]


def _extract_skus(item: Dict) -> List[str]:
    """Extraer todos los SKUs de un item: seller_custom_field, attributes SELLER_SKU, variations"""
    skus = []
    # 1) seller_custom_field a nivel raíz
    root_sku = item.get("seller_custom_field")
    if root_sku:
        skus.append(root_sku)
    # 2) attributes con id SELLER_SKU
    for attr in item.get("attributes", []):
        if attr.get("id") == "SELLER_SKU":
            val = attr.get("value_name") or ""
            if val and val not in skus:
                skus.append(val)
            for v in attr.get("values", []):
                vn = v.get("name") or ""
                if vn and vn not in skus:
                    skus.append(vn)
    # 3) variations: seller_custom_field + attribute_combinations
    for var in item.get("variations", []):
        var_sku = var.get("seller_custom_field")
        if var_sku and var_sku not in skus:
            skus.append(var_sku)
        for ac in var.get("attribute_combinations", []):
            if ac.get("id") == "SELLER_SKU":
                vn = ac.get("value_name") or ac.get("name") or ""
                if vn and vn not in skus:
                    skus.append(vn)
    return skus


def format_item(item: Dict, marca: str) -> Dict:
    """Formatear item de ML a estructura de reporte"""
    status_raw = item.get("status", "unknown")
    listing_type_raw = item.get("listing_type_id", "unknown")
    condition_raw = item.get("condition", "not_specified")
    shipping = item.get("shipping", {})
    price = item.get("price", 0) or 0
    original_price = item.get("original_price")
    available_qty = item.get("available_quantity", 0) or 0
    sold_qty = item.get("sold_quantity", 0) or 0
    initial_qty = item.get("initial_quantity", 0) or 0

    descuento = 0
    if original_price and original_price > price:
        descuento = round((1 - price / original_price) * 100, 1)

    health = item.get("health")
    tags = item.get("tags", [])
    catalog_listing = item.get("catalog_listing", False)
    catalog_product_id = item.get("catalog_product_id")
    date_created = item.get("date_created", "")
    last_updated = item.get("last_updated", "")

    dias_publicado = None
    if date_created:
        try:
            created_dt = datetime.fromisoformat(date_created.replace("Z", "+00:00"))
            dias_publicado = (datetime.now(ART) - created_dt).days
        except Exception:
            pass

    return {
        "item_id": item.get("id", ""),
        "marca": marca,
        "titulo": item.get("title", "N/A"),
        "status": status_raw,
        "status_label": STATUS_LABELS.get(status_raw, status_raw),
        "condition": condition_raw,
        "condition_label": CONDITION_LABELS.get(condition_raw, condition_raw),
        "listing_type": listing_type_raw,
        "listing_type_label": LISTING_TYPE_LABELS.get(listing_type_raw, listing_type_raw),
        "precio": price,
        "precio_original": original_price,
        "descuento_pct": descuento,
        "moneda": item.get("currency_id", "ARS"),
        "stock": available_qty,
        "vendidas": sold_qty,
        "stock_inicial": initial_qty,
        "envio_gratis": shipping.get("free_shipping", False),
        "logistica_full": "fulfillment" in shipping.get("logistic_type", ""),
        "permalink": item.get("permalink", ""),
        "thumbnail": f'{item.get("thumbnail", "")}?t={int(time.time())}' if item.get("thumbnail") else "",
        "fotos": len(item.get("pictures", [])),
        "fotos_urls": [p.get("secure_url", p.get("url", "")) for p in item.get("pictures", [])],
        "catalog_listing": catalog_listing,
        "catalog_product_id": catalog_product_id,
        "health": health,
        "tags": tags,
        "fecha_creacion": date_created,
        "ultima_actualizacion": last_updated,
        "dias_publicado": dias_publicado,
        "category_id": item.get("category_id", ""),
        "seller_sku": item.get("seller_custom_field") or "",
        "seller_skus": _extract_skus(item),
    }


def compute_kpis(publicaciones: List[Dict]) -> Dict:
    """Calcular KPIs del reporte"""
    total = len(publicaciones)
    if total == 0:
        return {
            "total_publicaciones": 0, "activas": 0, "pausadas": 0, "cerradas": 0,
            "stock_total": 0, "vendidas_total": 0, "precio_promedio": 0,
            "con_envio_gratis": 0, "con_full": 0, "con_descuento": 0, "con_catalogo": 0,
            "fotos_promedio": 0, "valor_stock_estimado": 0,
        }

    activas = sum(1 for p in publicaciones if p["status"] == "active")
    pausadas = sum(1 for p in publicaciones if p["status"] == "paused")
    cerradas = sum(1 for p in publicaciones if p["status"] == "closed")
    stock_total = sum(p["stock"] for p in publicaciones)
    vendidas_total = sum(p["vendidas"] for p in publicaciones)
    precios = [p["precio"] for p in publicaciones if p["precio"] > 0]
    precio_promedio = int(round(sum(precios) / len(precios))) if precios else 0
    con_envio_gratis = sum(1 for p in publicaciones if p["envio_gratis"])
    con_full = sum(1 for p in publicaciones if p["logistica_full"])
    con_descuento = sum(1 for p in publicaciones if p["descuento_pct"] > 0)
    con_catalogo = sum(1 for p in publicaciones if p["catalog_listing"])
    fotos_total = sum(p["fotos"] for p in publicaciones)
    fotos_promedio = round(fotos_total / total, 1)
    valor_stock = sum(p["precio"] * p["stock"] for p in publicaciones)

    return {
        "total_publicaciones": total, "activas": activas, "pausadas": pausadas, "cerradas": cerradas,
        "stock_total": stock_total, "vendidas_total": vendidas_total, "precio_promedio": precio_promedio,
        "con_envio_gratis": con_envio_gratis,
        "pct_envio_gratis": round(con_envio_gratis / total * 100, 1) if total else 0,
        "con_full": con_full,
        "pct_full": round(con_full / total * 100, 1) if total else 0,
        "con_descuento": con_descuento, "con_catalogo": con_catalogo,
        "fotos_promedio": fotos_promedio, "valor_stock_estimado": valor_stock,
    }


async def _fetch_marca_reporte(marca: str, status: str):
    """Fetch reporte completo de una marca (para uso paralelo)"""
    token = await get_token_by_marca(marca)
    if not token:
        return marca, {"error": "Sin autenticación", "publicaciones": [], "kpis": {}}

    uid = MARCAS[marca]
    item_ids = await get_seller_items(uid, token, status)
    items = await get_items_batch(item_ids, token)
    publicaciones = [format_item(item, marca) for item in items]
    publicaciones.sort(key=lambda x: x["vendidas"], reverse=True)
    kpis = compute_kpis(publicaciones)

    return marca, {"kpis": kpis, "publicaciones": publicaciones}


@router.get("/reporte/{marca}")
async def reporte_publicaciones_marca(
    marca: str,
    status: str = Query("active", description="Estado: active, paused, closed"),
):
    """Reporte completo de publicaciones de una marca"""
    marca = marca.upper()
    if marca not in MARCAS:
        raise HTTPException(status_code=400, detail=f"Marca no válida: {marca}")

    _, data = await _fetch_marca_reporte(marca, status)

    if "error" in data:
        return {"error": data["error"], "publicaciones": [], "kpis": {}}

    return {
        "marca": marca,
        "status_filtro": status,
        "timestamp": datetime.now(ART).isoformat(),
        "kpis": data["kpis"],
        "publicaciones": data["publicaciones"],
    }


@router.get("/reporte-todas")
async def reporte_todas_marcas(
    status: str = Query("active", description="Estado: active, paused, closed"),
):
    """Reporte consolidado de TODAS las marcas - ASYNC PARALELO"""
    # Fetch todas las marcas en paralelo
    results = await asyncio.gather(*[_fetch_marca_reporte(marca, status) for marca in MARCAS.keys()])

    resultado = {}
    kpis_por_marca = {}
    todas_publicaciones = []

    for marca, data in results:
        resultado[marca] = data
        kpis_por_marca[marca] = data.get("kpis", {})
        todas_publicaciones.extend(data.get("publicaciones", []))

    kpis_global = compute_kpis(todas_publicaciones)

    return {
        "timestamp": datetime.now(ART).isoformat(),
        "status_filtro": status,
        "kpis_global": kpis_global,
        "kpis_por_marca": kpis_por_marca,
        "datos": resultado,
    }


# --- Endpoints legacy ---

@router.get("/por-marca/{marca}")
async def publicaciones_por_marca(marca: str):
    """Obtener publicaciones de una marca (legacy)"""
    marca = marca.upper()
    if marca not in MARCAS:
        raise HTTPException(status_code=400, detail=f"Marca no válida: {marca}")

    token = await get_token_by_marca(marca)
    if not token:
        return {"error": f"No se pudo autenticar para {marca}", "publicaciones": []}

    uid = MARCAS[marca]
    item_ids = await get_seller_items(uid, token, "active")
    items = await get_items_batch(item_ids, token)

    publicaciones = []
    for item in items:
        formatted = format_item(item, marca)
        publicaciones.append({
            "item_id": formatted["item_id"],
            "titulo": formatted["titulo"],
            "precio": formatted["precio"],
            "stock": formatted["stock"],
            "vendidas": formatted["vendidas"],
            "listing_type": formatted["listing_type_label"],
            "url": formatted["permalink"],
            "thumbnail": formatted["thumbnail"],
            "status": formatted["status_label"],
            "envio_gratis": formatted["envio_gratis"],
            "condition": formatted["condition_label"],
        })

    publicaciones.sort(key=lambda x: x["vendidas"], reverse=True)

    return {
        "marca": marca,
        "timestamp": datetime.now(ART).isoformat(),
        "total": len(publicaciones),
        "publicaciones": publicaciones,
    }


@router.get("/todas")
async def publicaciones_todas():
    """Obtener publicaciones de TODAS las marcas (legacy) - ASYNC PARALELO"""

    async def fetch_marca(marca):
        token = await get_token_by_marca(marca)
        if not token:
            return marca, {"error": "Sin autenticación", "publicaciones": []}

        uid = MARCAS[marca]
        item_ids = await get_seller_items(uid, token, "active")
        items = await get_items_batch(item_ids[:20], token)

        publicaciones = []
        for item in items:
            formatted = format_item(item, marca)
            publicaciones.append({
                "item_id": formatted["item_id"],
                "titulo": formatted["titulo"],
                "precio": formatted["precio"],
                "stock": formatted["stock"],
                "vendidas": formatted["vendidas"],
            })

        return marca, {"total": len(publicaciones), "publicaciones": publicaciones}

    results = await asyncio.gather(*[fetch_marca(m) for m in MARCAS.keys()])

    return {
        "timestamp": datetime.now(ART).isoformat(),
        "datos": {marca: data for marca, data in results},
    }


@router.get("/consolidado")
async def publicaciones_consolidado():
    """Resumen consolidado: stock + vendidas por marca - ASYNC PARALELO"""

    async def fetch_consolidado(marca):
        token = await get_token_by_marca(marca)
        if not token:
            return marca, None

        uid = MARCAS[marca]
        item_ids = await get_seller_items(uid, token, "active")
        items = await get_items_batch(item_ids, token)

        total_stock = sum(item.get("available_quantity", 0) or 0 for item in items)
        total_vendidas = sum(item.get("sold_quantity", 0) or 0 for item in items)
        valor_stock = sum((item.get("price", 0) or 0) * (item.get("available_quantity", 0) or 0) for item in items)

        return marca, {
            "stock_total": total_stock,
            "vendidas_total": total_vendidas,
            "publicaciones_activas": len(items),
            "valor_stock_estimado": valor_stock,
        }

    results = await asyncio.gather(*[fetch_consolidado(m) for m in MARCAS.keys()])

    return {
        "timestamp": datetime.now(ART).isoformat(),
        "consolidado": {marca: data for marca, data in results if data},
    }


@router.get("/precios-promedio")
async def precios_promedio_ml():
    """Precio promedio de venta en ML por marca (de publicaciones activas)"""

    async def fetch_precios(marca):
        token = await get_token_by_marca(marca)
        if not token:
            return marca, None

        uid = MARCAS[marca]
        item_ids = await get_seller_items(uid, token, "active")
        items = await get_items_batch(item_ids, token)

        precios = []
        for item in items:
            price = item.get("price", 0) or 0
            if price > 0:
                precios.append(price)

        if not precios:
            return marca, {"precio_promedio": 0, "precio_min": 0, "precio_max": 0, "items": 0}

        return marca, {
            "precio_promedio": int(round(sum(precios) / len(precios))),
            "precio_min": int(min(precios)),
            "precio_max": int(max(precios)),
            "items": len(precios),
        }

    results = await asyncio.gather(*[fetch_precios(m) for m in MARCAS.keys()])

    return {
        "timestamp": datetime.now(ART).isoformat(),
        "precios": {marca: data for marca, data in results if data},
    }


_marca_cache: Dict[str, Dict] = {}
_marca_cache_ts: Dict[str, float] = {}

@router.post("/match-skus")
async def match_skus_ml(body: dict):
    """Buscar publicaciones ML por SKU de Odoo comparando contra todas las publicaciones.
    Body: { "marca": "SHAQ", "skus": ["STMLS0005000400", "STMLS0005000410"] }
    Retorna: { "items": [{ item_id, titulo, stock, skus_matched }] }
    """
    marca = body.get("marca")
    skus = body.get("skus", [])
    if not marca or marca not in MARCAS:
        raise HTTPException(status_code=400, detail="Marca inválida")
    if not skus:
        return {"items": []}

    # Normalizar SKUs buscados
    skus_upper = set(s.upper().strip() for s in skus if s)

    # Cache de items raw por marca (5 min) — fetch individual para tener variaciones completas
    now = time.time()
    if marca not in _marca_cache or (now - _marca_cache_ts.get(marca, 0)) > 300:
        token = await get_token_by_marca(marca)
        if not token:
            raise HTTPException(status_code=401, detail="Sin autenticación para " + marca)
        uid = MARCAS[marca]
        item_ids = await get_seller_items(uid, token, "active")
        items = await get_items_full(item_ids, token)
        _marca_cache[marca] = items
        _marca_cache_ts[marca] = now
    else:
        items = _marca_cache[marca]

    # Preparar SKUs ML
    items_with_skus = []
    for item in items:
        extracted = _extract_skus(item)
        items_with_skus.append((item, [s.upper() for s in extracted]))

    # 1) Match exacto por SKU
    matched = []
    seen = set()
    match_type = "SKU"
    for item, ml_skus in items_with_skus:
        if not ml_skus:
            continue
        exact = [s for s in ml_skus if s in skus_upper]
        if exact and item.get("id") not in seen:
            seen.add(item.get("id"))
            matched.append({
                "item_id": item.get("id", ""),
                "titulo": item.get("title", ""),
                "stock": item.get("available_quantity", 0) or 0,
                "precio": item.get("price", 0) or 0,
                "permalink": item.get("permalink", ""),
                "match_type": "SKU",
            })

    # 2) Si no hay match exacto, buscar por prefijo (primeros 10 chars)
    if not matched:
        prefixes = set(s[:10] for s in skus_upper if len(s) >= 10)
        if prefixes:
            for item, ml_skus in items_with_skus:
                if not ml_skus:
                    continue
                prefix_match = any(s[:10] in prefixes for s in ml_skus if len(s) >= 10)
                if prefix_match and item.get("id") not in seen:
                    seen.add(item.get("id"))
                    matched.append({
                        "item_id": item.get("id", ""),
                        "titulo": item.get("title", ""),
                        "stock": item.get("available_quantity", 0) or 0,
                        "precio": item.get("price", 0) or 0,
                        "permalink": item.get("permalink", ""),
                        "match_type": "prefijo",
                    })
            if matched:
                match_type = "prefijo"

    # 3) Si no hay match por prefijo, buscar por nombre de modelo en títulos ML
    product_name = body.get("product_name", "").lower().strip()
    if not matched and product_name:
        brand_name = marca.lower()
        # El nombre del modelo es la primera palabra que no sea la marca
        name_words = product_name.split()
        model_name = next((w for w in name_words if w != brand_name and len(w) > 1), None)
        if model_name:
            for item, ml_skus in items_with_skus:
                title = (item.get("title", "") or "").lower()
                # El título debe contener la marca Y el nombre del modelo
                if model_name in title and brand_name in title and item.get("id") not in seen:
                    seen.add(item.get("id"))
                    matched.append({
                        "item_id": item.get("id", ""),
                        "titulo": item.get("title", ""),
                        "stock": item.get("available_quantity", 0) or 0,
                        "precio": item.get("price", 0) or 0,
                        "permalink": item.get("permalink", ""),
                        "match_type": "nombre",
                    })
            if matched:
                match_type = "nombre"

    return {
        "items": matched,
        "match_type": match_type if matched else None,
        "total_items_marca": len(items),
    }


# ── Preguntas sin responder (últimos 15 días) ──────────────────────
_preguntas_cache: Dict[str, dict] = {}
_preguntas_cache_ts: float = 0
PREGUNTAS_CACHE_TTL = 300  # 5 min

@router.get("/preguntas-sin-responder")
async def preguntas_sin_responder():
    """Fetch unanswered questions from last 15 days for all brands."""
    global _preguntas_cache, _preguntas_cache_ts

    now = time.time()
    if _preguntas_cache and (now - _preguntas_cache_ts) < PREGUNTAS_CACHE_TTL:
        return _preguntas_cache

    desde = datetime.now(ART) - timedelta(days=15)
    desde_iso = desde.strftime("%Y-%m-%dT00:00:00.000-03:00")

    async def fetch_preguntas_marca(marca: str, uid: int):
        token = await get_token_by_marca(marca)
        if not token:
            return marca, []

        preguntas = []
        offset = 0
        limit = 50
        async with httpx.AsyncClient() as client:
            while True:
                url = (
                    f"https://api.mercadolibre.com/questions/search"
                    f"?seller_id={uid}&status=UNANSWERED"
                    f"&sort_fields=date_created&sort_types=DESC"
                    f"&api_version=4"
                    f"&offset={offset}&limit={limit}"
                )
                try:
                    resp = await client.get(
                        url,
                        headers={"Authorization": f"Bearer {token}"},
                        timeout=10
                    )
                    resp.raise_for_status()
                    data = resp.json()
                except Exception as e:
                    print(f"Error fetching questions for {marca}: {e}")
                    break

                questions = data.get("questions", [])
                if not questions:
                    break

                for q in questions:
                    created = q.get("date_created", "")
                    if created and created < desde_iso:
                        # Older than 15 days, stop
                        questions = []
                        break
                    preguntas.append({
                        "id": q.get("id"),
                        "text": q.get("text", ""),
                        "date_created": created,
                        "item_id": q.get("item_id", ""),
                        "from_id": q.get("from", {}).get("id") if isinstance(q.get("from"), dict) else None,
                    })

                total = data.get("total", 0)
                offset += limit
                if offset >= total or not questions:
                    break

        # Fetch item titles for each unique item_id
        item_ids = list(set(p["item_id"] for p in preguntas if p["item_id"]))
        item_titles = {}
        if item_ids and token:
            async with httpx.AsyncClient() as client:
                sem = asyncio.Semaphore(10)
                async def fetch_title(iid):
                    async with sem:
                        try:
                            resp = await client.get(
                                f"https://api.mercadolibre.com/items/{iid}?attributes=title,permalink",
                                headers={"Authorization": f"Bearer {token}"},
                                timeout=10
                            )
                            resp.raise_for_status()
                            d = resp.json()
                            item_titles[iid] = {
                                "title": d.get("title", ""),
                                "permalink": d.get("permalink", ""),
                            }
                        except:
                            pass
                await asyncio.gather(*[fetch_title(iid) for iid in item_ids])

        for p in preguntas:
            info = item_titles.get(p["item_id"], {})
            p["item_title"] = info.get("title", "")
            p["item_permalink"] = info.get("permalink", "")

        return marca, preguntas

    tasks = [fetch_preguntas_marca(m, uid) for m, uid in MARCAS.items()]
    results = await asyncio.gather(*tasks)

    response = {}
    for marca, preguntas in results:
        response[marca] = {
            "sin_responder": len(preguntas),
            "preguntas": preguntas,
        }

    _preguntas_cache = response
    _preguntas_cache_ts = time.time()
    return response
