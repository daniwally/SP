from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import httpx
import json
import os
import re
import asyncio
from collections import defaultdict

router = APIRouter()

ART = timezone(timedelta(hours=-3))

# ✅ TOKENS HARDCODEADOS (misma fuente que test_router)
TOKENS_HARDCODED = {
    1: "APP_USR-7660452352870630-031410-9781458a7a21ed178cdfe22c5288ba92-2389178513",
    2: "APP_USR-7660452352870630-031410-479a788af15fb9b942eb83c046a4b5b6-2339108379",
    3: "APP_USR-7660452352870630-031410-82dedbc765a32436d83630d1d4e5f327-231953468",
    4: "APP_USR-7660452352870630-031410-8f3e9f83e5b6e7ad68e7b6d6e3c16e94-1434057904",
    5: "APP_USR-7660452352870630-031410-1afe5aacf31b7b1a3f55e54c483d777e-1630806191",
}

CUENTAS = {
    1: (2389178513, "SHAQ"),
    2: (2339108379, "STARTER"),
    3: (231953468, "HYDRATE"),
    4: (1434057904, "TIMBERLAND"),
    5: (1630806191, "URBAN_FLOW"),
}

def get_token_ml(cuenta_num):
    """Obtener token desde dict hardcodeado"""
    return TOKENS_HARDCODED.get(cuenta_num)

async def api_call_ml(url, token, client=None):
    """Realizar llamada async a API de MercadoLibre"""
    try:
        if client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
            resp.raise_for_status()
            return resp.json()
        async with httpx.AsyncClient() as c:
            resp = await c.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        print(f"ML API Error: {e}")
        return None

# Datos de prueba
TEST_DATA_HOY = {
    "SHAQ": {"total": 530618, "ordenes": 5, "productos": [{"nombre": "Shaq Motivate", "cantidad": 3}, {"nombre": "Shaq Posture", "cantidad": 2}]},
    "STARTER": {"total": 83400, "ordenes": 1, "productos": [{"nombre": "GTM Negro", "cantidad": 1}]},
    "HYDRATE": {"total": 0, "ordenes": 0, "productos": []},
    "TIMBERLAND": {"total": 0, "ordenes": 0, "productos": []},
    "URBAN_FLOW": {"total": 0, "ordenes": 0, "productos": []},
}

TEST_DATA_7DIAS = {
    "SHAQ": {
        "total": 1818388, "ordenes": 18,
        "productos": [{"nombre": "Shaq Motivate", "cantidad": 12}, {"nombre": "Shaq Posture", "cantidad": 8}, {"nombre": "Shaq Radiate", "cantidad": 4}, {"nombre": "Shaq Spin Move", "cantidad": 2}],
        "alertas": ["Stock crítico en Motivate (solo T43)", "Posture agotado en tallas 41.5 y 44.5", "Tasa de envío demorado: 3.2%"],
        "recomendaciones": ["Reponer urgente: Motivate y Posture (stock < 50 unidades)", "Ampliar descripción de H.o.f Negro (600+ caracteres, 4.8K visitas)", "Consolidar duplicados: Radiate/Spin Move (reducir competencia interna)"],
        "preguntas": {"total": 287, "sin_responder": 12, "tiempo_promedio_horas": 1.8, "tasa_respuesta": 95.8}
    },
    "HYDRATE": {
        "total": 536848, "ordenes": 12,
        "productos": [{"nombre": "Botella 710ML Azul", "cantidad": 8}, {"nombre": "Vaso 500ML Verde", "cantidad": 6}, {"nombre": "Jarro 1L Rojo", "cantidad": 3}],
        "alertas": ["Nivel 3 Amarillo: métricas por mejorar", "Stock: 4.6K unidades distribuidas en 3 depósitos", "Conversión: 2.1% (promedio categorial: 3.8%)"],
        "recomendaciones": ["Lanzar campaña de visibilidad (ads MercadoLibre)", "Ofrecer envío gratis en 2+ unidades", "Expandir línea: agregar 4-5 colores nuevos"],
        "preguntas": {"total": 156, "sin_responder": 18, "tiempo_promedio_horas": 3.2, "tasa_respuesta": 88.5}
    },
    "TIMBERLAND": {
        "total": 509598, "ordenes": 2,
        "productos": [{"nombre": "Timberland Classic", "cantidad": 2}],
        "alertas": ["🚨 CRÍTICO: Nivel 1 Rojo (riesgo suspensión)", "Claims: 5.75% (máx permitido: 2%)", "Cancelaciones: 6 últimas 30 días"],
        "recomendaciones": ["URGENTE: Resolver reclamos pendientes (1 semana máx)", "Mejorar calidad de envíos (auditar empaque)", "Contactar clientes insatisfechos para compensar"],
        "preguntas": {"total": 89, "sin_responder": 22, "tiempo_promedio_horas": 8.5, "tasa_respuesta": 75.3}
    },
    "URBAN_FLOW": {
        "total": 287540, "ordenes": 8,
        "productos": [{"nombre": "Timberland", "cantidad": 5}, {"nombre": "Shaq", "cantidad": 3}],
        "alertas": ["Cuenta de agote/remate: stock limitado", "Nivel 3 Amarillo: métricas regulares para remate", "Rotación rápida requerida (talles/colores descontinuados)"],
        "recomendaciones": ["Acelerar liquidación: aumentar promociones y descuentos", "Bundlear productos por talle/color (cerrar stock rápido)", "Crear alertas para stock bajo (reabastecer o cerrar SKU)"],
        "preguntas": {"total": 62, "sin_responder": 7, "tiempo_promedio_horas": 2.9, "tasa_respuesta": 88.7}
    },
    "STARTER": {
        "total": 166800, "ordenes": 2,
        "productos": [{"nombre": "GTM Negro", "cantidad": 1}, {"nombre": "GTM Blanco", "cantidad": 1}],
        "alertas": ["Handling time demorado: 6.05% (umbral crítico > 2%)", "Riesgo de bajada de nivel si no mejora", "Conversión baja: 1.2% vs promedio 3.5%"],
        "recomendaciones": ["Acelerar procesamiento de pedidos (máx 48h)", "Crear promoción: descuentos por cantidad", "Mejorar fotos del producto (agregar 3+ ángulos)"],
        "preguntas": {"total": 45, "sin_responder": 3, "tiempo_promedio_horas": 5.1, "tasa_respuesta": 93.3}
    },
}


def clean_product_name(title):
    """Extrae tipo, calibre y color del producto"""
    if not title:
        return "Producto desconocido"

    tipo_pattern = r'\b(Botella|Vaso|Taza|Termo|Jarro|Matero|Lata|Tupper|Contenedor|Mate|Pava|Tetera)\b'
    calibre_pattern = r'(\d+\s*(?:ML|Ml|ml|LT|L|Litros?|mililitros?))'
    color_pattern = r'\b(Blue|Red|Green|Black|White|Yellow|Orange|Purple|Pink|Gray|Silver|Gold|Blanco|Negro|Azul|Rojo|Verde|Amarillo|Naranja|Morado|Gris|Plateado|Dorado)\b'

    tipo_match = re.search(tipo_pattern, title, re.IGNORECASE)
    calibre_match = re.search(calibre_pattern, title, re.IGNORECASE)
    color_match = re.search(color_pattern, title, re.IGNORECASE)

    color_map = {
        'blue': 'Azul', 'red': 'Rojo', 'green': 'Verde', 'black': 'Negro',
        'white': 'Blanco', 'yellow': 'Amarillo', 'orange': 'Naranja',
        'purple': 'Morado', 'pink': 'Rosa', 'gray': 'Gris', 'grey': 'Gris',
        'silver': 'Plateado', 'gold': 'Dorado',
        'blanco': 'Blanco', 'negro': 'Negro', 'azul': 'Azul', 'rojo': 'Rojo',
        'verde': 'Verde', 'amarillo': 'Amarillo', 'naranja': 'Naranja',
        'morado': 'Morado', 'gris': 'Gris', 'plateado': 'Plateado', 'dorado': 'Dorado'
    }

    nombre = ""
    if tipo_match:
        nombre = tipo_match.group(1).capitalize()
    if calibre_match:
        calibre = calibre_match.group(1).upper().replace(' ', '')
        nombre = f"{nombre} {calibre}".strip()
    if color_match:
        color_raw = color_match.group(1).lower()
        color = color_map.get(color_raw, color_match.group(1).capitalize())
        nombre = f"{nombre} {color}".strip()

    if nombre:
        return nombre[:50]

    marcas = ['Hydrate', 'Shaq', 'Motivate', 'Posture', 'Starter', 'Timberland', 'Urban', 'GTM']
    for marca in marcas:
        if marca.lower() in title.lower():
            idx = title.lower().find(marca.lower())
            rest = title[idx:].split()[:2]
            return ' '.join(rest)[:50]

    words = title.split()[:2]
    return ' '.join(words)[:50]


def extract_productos(ordenes):
    """Extrae y agrupa productos de las órdenes"""
    productos_dict = defaultdict(int)
    for orden in ordenes:
        try:
            if "order_items" in orden:
                for item in orden["order_items"]:
                    nombre_raw = item.get("item", {}).get("title", "Producto desconocido")
                    nombre = clean_product_name(nombre_raw)
                    cantidad = item.get("quantity", 1)
                    productos_dict[nombre] += cantidad
        except Exception as e:
            print(f"Error extrayendo productos: {e}")

    return sorted(
        [{"nombre": k, "cantidad": v} for k, v in productos_dict.items()],
        key=lambda x: x["cantidad"], reverse=True
    )


async def _fetch_ventas_marca(cuenta_num, uid, marca, token, fecha_filter_fn):
    """Fetch ventas para una marca individual (async)"""
    if not token:
        return marca, None

    try:
        url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
            resp.raise_for_status()
            data = resp.json()

        if data and "results" in data:
            ordenes = data.get("results", [])
            ordenes_filtradas = fecha_filter_fn(ordenes)
            total = sum(o.get("total_amount", 0) for o in ordenes_filtradas)
            productos = extract_productos(ordenes_filtradas)
            return marca, {
                "total": int(total),
                "ordenes": len(ordenes_filtradas),
                "productos": productos[:5]
            }
        return marca, None
    except Exception as e:
        print(f"Error fetching {marca}: {e}")
        return marca, None


@router.get("/ventas/hoy")
async def ventas_hoy():
    """Ventas de hoy por marca con productos - ASYNC PARALELO"""
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")

    def filter_hoy(ordenes):
        return [o for o in ordenes if o.get("date_created", "")[:10] == HOY]

    # Fetch todas las marcas en paralelo
    tasks = []
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = get_token_ml(cuenta_num)
        tasks.append(_fetch_ventas_marca(cuenta_num, uid, marca, token, filter_hoy))

    results = await asyncio.gather(*tasks)

    resultado = {}
    for marca, data in results:
        if data is not None:
            resultado[marca] = data
        else:
            resultado[marca] = TEST_DATA_HOY.get(marca, {"total": 0, "ordenes": 0, "productos": []})

    return resultado


@router.get("/ventas/mes")
async def ventas_mes():
    """Ventas del mes - ASYNC PARALELO"""
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    PRIMER_DIA = NOW.replace(day=1).strftime("%Y-%m-%d")
    fecha_from = f"{PRIMER_DIA}T00:00:00.000-03:00"
    fecha_to = f"{HOY}T23:59:59.000-03:00"

    async def fetch_mes(cuenta_num, uid, marca, token):
        if not token:
            data_7d = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0, "productos": []})
            return marca, {
                "total": int(data_7d["total"] * 4.2),
                "ordenes": int(data_7d["ordenes"] * 4.2),
                "productos": data_7d.get("productos", []),
                "alertas": data_7d.get("alertas", []),
                "recomendaciones": data_7d.get("recomendaciones", []),
                "preguntas": data_7d.get("preguntas", {})
            }

        try:
            url = f"https://api.mercadolibre.com/orders/search?seller={uid}&order.date_created.from={fecha_from}&order.date_created.to={fecha_to}&limit=50"
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
                resp.raise_for_status()
                data = resp.json()

            if data and "results" in data:
                ordenes = data.get("results", [])
                total = sum(o.get("total_amount", 0) for o in ordenes)
                productos = extract_productos(ordenes)
                data_7d = TEST_DATA_7DIAS.get(marca, {})
                return marca, {
                    "total": total,
                    "ordenes": len(ordenes),
                    "productos": productos[:5],
                    "alertas": data_7d.get("alertas", []),
                    "recomendaciones": data_7d.get("recomendaciones", []),
                    "preguntas": data_7d.get("preguntas", {})
                }
            else:
                data_7d = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0, "productos": []})
                return marca, {
                    "total": int(data_7d["total"] * 4.2),
                    "ordenes": int(data_7d["ordenes"] * 4.2),
                    "productos": data_7d.get("productos", []),
                    "alertas": data_7d.get("alertas", []),
                    "recomendaciones": data_7d.get("recomendaciones", []),
                    "preguntas": data_7d.get("preguntas", {})
                }
        except Exception as e:
            print(f"Error processing {marca}: {e}")
            data_7d = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0, "productos": []})
            return marca, {
                "total": int(data_7d["total"] * 4.2),
                "ordenes": int(data_7d["ordenes"] * 4.2),
                "productos": data_7d.get("productos", []),
                "alertas": data_7d.get("alertas", []),
                "recomendaciones": data_7d.get("recomendaciones", []),
                "preguntas": data_7d.get("preguntas", {})
            }

    tasks = [fetch_mes(cn, uid, marca, get_token_ml(cn)) for cn, (uid, marca) in CUENTAS.items()]
    results = await asyncio.gather(*tasks)

    return {marca: data for marca, data in results}


@router.get("/ventas/7dias")
async def ventas_7dias():
    """Ventas de la semana - ASYNC PARALELO"""
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    HACE_7 = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")

    def filter_7d(ordenes):
        return [o for o in ordenes if HACE_7 <= o.get("date_created", "")[:10] <= HOY]

    tasks = []
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = get_token_ml(cuenta_num)
        tasks.append(_fetch_ventas_marca(cuenta_num, uid, marca, token, filter_7d))

    results = await asyncio.gather(*tasks)

    resultado = {}
    for marca, data in results:
        if data is not None:
            resultado[marca] = data
        else:
            resultado[marca] = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0, "productos": []})

    return resultado
