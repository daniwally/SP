"""
Router para obtener reporte completo de publicaciones desde ML API
Estado, Tipo, Precio, Marca, Stock, Vendidas, Envío, Condición, Health, etc.
"""

from fastapi import APIRouter, HTTPException, Query
import urllib.request
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

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

# Tokens hardcodeados (misma fuente que ml_router)
TOKENS_HARDCODED = {
    "SHAQ": "APP_USR-7660452352870630-031410-9781458a7a21ed178cdfe22c5288ba92-2389178513",
    "STARTER": "APP_USR-7660452352870630-031410-479a788af15fb9b942eb83c046a4b5b6-2339108379",
    "HYDRATE": "APP_USR-7660452352870630-031410-82dedbc765a32436d83630d1d4e5f327-231953468",
    "TIMBERLAND": "APP_USR-7660452352870630-031410-8f3e9f83e5b6e7ad68e7b6d6e3c16e94-1434057904",
    "URBAN_FLOW": "APP_USR-7660452352870630-031410-1afe5aacf31b7b1a3f55e54c483d777e-1630806191",
}

# También intentar cargar desde config
try:
    with open("backend/config_tokens.json") as f:
        _cfg = json.load(f)
        _tokens_cfg = _cfg.get("tokens", {})
        _cuentas_cfg = _cfg.get("cuentas", {})
        for num_str, marca_name in _cuentas_cfg.items():
            if num_str in _tokens_cfg:
                TOKENS_HARDCODED[marca_name] = _tokens_cfg[num_str]
except Exception:
    pass

# Mapeo legible de listing types
LISTING_TYPE_LABELS = {
    "gold_special": "Premium (Clásica)",
    "gold_pro": "Premium",
    "gold": "Oro",
    "silver": "Plata",
    "bronze": "Bronce",
    "free": "Gratuita",
}

# Mapeo legible de status
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


def api_call(url, token):
    """Llamada a API de ML con timeout"""
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"ML API Error [{url[:80]}]: {e}")
        return None


def get_seller_items(uid: int, token: str, status: str = "active") -> List[str]:
    """Obtener IDs de items de un seller con paginación"""
    all_ids = []
    offset = 0
    limit = 50

    while True:
        url = f"https://api.mercadolibre.com/users/{uid}/items/search?status={status}&offset={offset}&limit={limit}"
        data = api_call(url, token)
        if not data:
            break

        ids = data.get("results", [])
        all_ids.extend(ids)

        total = data.get("paging", {}).get("total", 0)
        offset += limit
        if offset >= total:
            break

    return all_ids


def get_items_batch(item_ids: List[str], token: str) -> List[Dict]:
    """Obtener detalles de múltiples items usando multi-get (hasta 20 por request)"""
    all_items = []

    for i in range(0, len(item_ids), 20):
        batch = item_ids[i:i + 20]
        ids_str = ",".join(batch)
        url = f"https://api.mercadolibre.com/items?ids={ids_str}"
        data = api_call(url, token)
        if data and isinstance(data, list):
            for entry in data:
                if entry.get("code") == 200 and entry.get("body"):
                    all_items.append(entry["body"])

    return all_items


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

    # Calcular descuento
    descuento = 0
    if original_price and original_price > price:
        descuento = round((1 - price / original_price) * 100, 1)

    # Health / calidad
    health = item.get("health")
    tags = item.get("tags", [])

    # Determinar si tiene catálogo
    catalog_listing = item.get("catalog_listing", False)
    catalog_product_id = item.get("catalog_product_id")

    # Fecha de creación
    date_created = item.get("date_created", "")
    last_updated = item.get("last_updated", "")

    # Calcular días publicado
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
        "thumbnail": item.get("thumbnail", ""),
        "fotos": len(item.get("pictures", [])),
        "catalog_listing": catalog_listing,
        "catalog_product_id": catalog_product_id,
        "health": health,
        "tags": tags,
        "fecha_creacion": date_created,
        "ultima_actualizacion": last_updated,
        "dias_publicado": dias_publicado,
        "category_id": item.get("category_id", ""),
    }


def compute_kpis(publicaciones: List[Dict]) -> Dict:
    """Calcular KPIs del reporte"""
    total = len(publicaciones)
    if total == 0:
        return {
            "total_publicaciones": 0,
            "activas": 0,
            "pausadas": 0,
            "cerradas": 0,
            "stock_total": 0,
            "vendidas_total": 0,
            "precio_promedio": 0,
            "con_envio_gratis": 0,
            "con_full": 0,
            "con_descuento": 0,
            "con_catalogo": 0,
            "fotos_promedio": 0,
            "valor_stock_estimado": 0,
        }

    activas = sum(1 for p in publicaciones if p["status"] == "active")
    pausadas = sum(1 for p in publicaciones if p["status"] == "paused")
    cerradas = sum(1 for p in publicaciones if p["status"] == "closed")
    stock_total = sum(p["stock"] for p in publicaciones)
    vendidas_total = sum(p["vendidas"] for p in publicaciones)
    precios = [p["precio"] for p in publicaciones if p["precio"] > 0]
    precio_promedio = round(sum(precios) / len(precios), 2) if precios else 0
    con_envio_gratis = sum(1 for p in publicaciones if p["envio_gratis"])
    con_full = sum(1 for p in publicaciones if p["logistica_full"])
    con_descuento = sum(1 for p in publicaciones if p["descuento_pct"] > 0)
    con_catalogo = sum(1 for p in publicaciones if p["catalog_listing"])
    fotos_total = sum(p["fotos"] for p in publicaciones)
    fotos_promedio = round(fotos_total / total, 1)
    valor_stock = sum(p["precio"] * p["stock"] for p in publicaciones)

    return {
        "total_publicaciones": total,
        "activas": activas,
        "pausadas": pausadas,
        "cerradas": cerradas,
        "stock_total": stock_total,
        "vendidas_total": vendidas_total,
        "precio_promedio": precio_promedio,
        "con_envio_gratis": con_envio_gratis,
        "pct_envio_gratis": round(con_envio_gratis / total * 100, 1) if total else 0,
        "con_full": con_full,
        "pct_full": round(con_full / total * 100, 1) if total else 0,
        "con_descuento": con_descuento,
        "con_catalogo": con_catalogo,
        "fotos_promedio": fotos_promedio,
        "valor_stock_estimado": valor_stock,
    }


@router.get("/reporte/{marca}")
async def reporte_publicaciones_marca(
    marca: str,
    status: str = Query("active", description="Estado: active, paused, closed"),
):
    """Reporte completo de publicaciones de una marca"""
    marca = marca.upper()
    if marca not in MARCAS:
        raise HTTPException(status_code=400, detail=f"Marca no válida: {marca}")

    token = TOKENS_HARDCODED.get(marca)
    if not token:
        return {"error": f"No se pudo autenticar para {marca}", "publicaciones": [], "kpis": {}}

    uid = MARCAS[marca]

    # Obtener IDs de items
    item_ids = get_seller_items(uid, token, status)

    # Obtener detalles en batch
    items = get_items_batch(item_ids, token)

    # Formatear
    publicaciones = [format_item(item, marca) for item in items]

    # Ordenar por vendidas desc
    publicaciones.sort(key=lambda x: x["vendidas"], reverse=True)

    kpis = compute_kpis(publicaciones)

    return {
        "marca": marca,
        "status_filtro": status,
        "timestamp": datetime.now(ART).isoformat(),
        "kpis": kpis,
        "publicaciones": publicaciones,
    }


@router.get("/reporte-todas")
async def reporte_todas_marcas(
    status: str = Query("active", description="Estado: active, paused, closed"),
):
    """Reporte consolidado de TODAS las marcas"""
    resultado = {}
    todas_publicaciones = []
    kpis_por_marca = {}

    for marca in MARCAS.keys():
        token = TOKENS_HARDCODED.get(marca)
        if not token:
            resultado[marca] = {"error": "Sin autenticación", "publicaciones": [], "kpis": {}}
            continue

        uid = MARCAS[marca]
        item_ids = get_seller_items(uid, token, status)
        items = get_items_batch(item_ids, token)
        publicaciones = [format_item(item, marca) for item in items]
        publicaciones.sort(key=lambda x: x["vendidas"], reverse=True)
        kpis = compute_kpis(publicaciones)

        resultado[marca] = {
            "kpis": kpis,
            "publicaciones": publicaciones,
        }
        kpis_por_marca[marca] = kpis
        todas_publicaciones.extend(publicaciones)

    # KPIs globales
    kpis_global = compute_kpis(todas_publicaciones)

    return {
        "timestamp": datetime.now(ART).isoformat(),
        "status_filtro": status,
        "kpis_global": kpis_global,
        "kpis_por_marca": kpis_por_marca,
        "datos": resultado,
    }


# --- Mantener endpoints legacy para compatibilidad ---

@router.get("/por-marca/{marca}")
async def publicaciones_por_marca(marca: str):
    """Obtener publicaciones de una marca (legacy, redirige a reporte)"""
    marca = marca.upper()
    if marca not in MARCAS:
        raise HTTPException(status_code=400, detail=f"Marca no válida: {marca}")

    token = TOKENS_HARDCODED.get(marca)
    if not token:
        return {"error": f"No se pudo autenticar para {marca}", "publicaciones": []}

    uid = MARCAS[marca]
    item_ids = get_seller_items(uid, token, "active")
    items = get_items_batch(item_ids, token)

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
    """Obtener publicaciones de TODAS las marcas (legacy)"""
    resultado = {}

    for marca in MARCAS.keys():
        token = TOKENS_HARDCODED.get(marca)
        if not token:
            resultado[marca] = {"error": "Sin autenticación", "publicaciones": []}
            continue

        uid = MARCAS[marca]
        item_ids = get_seller_items(uid, token, "active")
        items = get_items_batch(item_ids[:20], token)

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

        resultado[marca] = {
            "total": len(publicaciones),
            "publicaciones": publicaciones,
        }

    return {
        "timestamp": datetime.now(ART).isoformat(),
        "datos": resultado,
    }


@router.get("/consolidado")
async def publicaciones_consolidado():
    """Resumen consolidado: stock + vendidas por marca"""
    resultado = {}

    for marca in MARCAS.keys():
        token = TOKENS_HARDCODED.get(marca)
        if not token:
            continue

        uid = MARCAS[marca]
        item_ids = get_seller_items(uid, token, "active")
        items = get_items_batch(item_ids, token)

        total_stock = sum(item.get("available_quantity", 0) or 0 for item in items)
        total_vendidas = sum(item.get("sold_quantity", 0) or 0 for item in items)
        valor_stock = sum((item.get("price", 0) or 0) * (item.get("available_quantity", 0) or 0) for item in items)

        resultado[marca] = {
            "stock_total": total_stock,
            "vendidas_total": total_vendidas,
            "publicaciones_activas": len(items),
            "valor_stock_estimado": valor_stock,
        }

    return {
        "timestamp": datetime.now(ART).isoformat(),
        "consolidado": resultado,
    }
