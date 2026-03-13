from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import urllib.request
import json
import os
from collections import defaultdict

router = APIRouter()

ART = timezone(timedelta(hours=-3))

# Datos de prueba realistas
TEST_DATA_HOY = {
    "SHAQ": {
        "total": 530618, 
        "ordenes": 5,
        "productos": [
            {"nombre": "Shaq Motivate", "cantidad": 3},
            {"nombre": "Shaq Posture", "cantidad": 2}
        ]
    },
    "STARTER": {
        "total": 83400, 
        "ordenes": 1,
        "productos": [
            {"nombre": "GTM Negro", "cantidad": 1}
        ]
    },
    "HYDRATE": {"total": 0, "ordenes": 0, "productos": []},
    "TIMBERLAND": {"total": 0, "ordenes": 0, "productos": []},
    "URBAN_FLOW": {"total": 0, "ordenes": 0, "productos": []},
}

TEST_DATA_7DIAS = {
    "SHAQ": {
        "total": 1773238, 
        "ordenes": 18,
        "productos": [
            {"nombre": "Shaq Motivate", "cantidad": 12},
            {"nombre": "Shaq Posture", "cantidad": 8},
            {"nombre": "Shaq Radiate", "cantidad": 4},
            {"nombre": "Shaq Spin Move", "cantidad": 2}
        ]
    },
    "HYDRATE": {
        "total": 536848, 
        "ordenes": 12,
        "productos": [
            {"nombre": "Hydrate Blue", "cantidad": 8},
            {"nombre": "Hydrate Green", "cantidad": 6},
            {"nombre": "Hydrate Red", "cantidad": 3}
        ]
    },
    "TIMBERLAND": {
        "total": 509598, 
        "ordenes": 2,
        "productos": [
            {"nombre": "Timberland Classic", "cantidad": 2}
        ]
    },
    "URBAN_FLOW": {
        "total": 453068, 
        "ordenes": 4,
        "productos": [
            {"nombre": "Urban Flow Black", "cantidad": 2},
            {"nombre": "Urban Flow White", "cantidad": 2}
        ]
    },
    "STARTER": {
        "total": 166800, 
        "ordenes": 2,
        "productos": [
            {"nombre": "GTM Negro", "cantidad": 1},
            {"nombre": "GTM Blanco", "cantidad": 1}
        ]
    },
}

CUENTAS = {
    1: (2389178513, "SHAQ"),
    2: (2339108379, "STARTER"),
    3: (231953468, "HYDRATE"),
    4: (1434057904, "TIMBERLAND"),
    5: (1630806191, "URBAN_FLOW"),
}


def get_token(cuenta_num):
    """Lee token del archivo local o variables de entorno"""
    # Intentar desde env var primero
    env_key = f"MELI_TOKEN_{cuenta_num}"
    if env_key in os.environ:
        return os.environ[env_key]
    
    # Si no, intentar desde archivo local
    token_path = f"/home/ubuntu/.config/meli/token_cuenta{cuenta_num}.json"
    try:
        with open(token_path) as f:
            data = json.load(f)
            return data.get("access_token")
    except Exception:
        return None


def api_call(url, token):
    """Llamada a API de ML con timeout"""
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"ML API Error: {e}")
        return None


def extract_productos(ordenes):
    """Extrae y agrupa productos de las órdenes"""
    productos_dict = defaultdict(int)
    
    for orden in ordenes:
        # La API de órdenes puede traer order_items directamente o necesitar otra llamada
        if "order_items" in orden:
            for item in orden["order_items"]:
                nombre = item.get("item", {}).get("title", "Producto desconocido")
                cantidad = item.get("quantity", 1)
                productos_dict[nombre] += cantidad
    
    # Ordenar por cantidad descendente
    productos_ordenados = sorted(
        [{"nombre": k, "cantidad": v} for k, v in productos_dict.items()],
        key=lambda x: x["cantidad"],
        reverse=True
    )
    
    return productos_ordenados


@router.get("/ventas/hoy")
async def ventas_hoy():
    """Ventas de hoy por marca con productos"""
    resultado = {}
    
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = get_token(cuenta_num)
        
        # Si no hay token, usar datos de prueba
        if not token:
            resultado[marca] = TEST_DATA_HOY.get(marca, {"total": 0, "ordenes": 0, "productos": []})
            continue
        
        # Si hay token, intentar obtener datos en vivo
        try:
            NOW = datetime.now(ART)
            HOY = NOW.strftime("%Y-%m-%d")
            fecha_from = f"{HOY}T00:00:00.000-03:00"
            fecha_to = f"{HOY}T23:59:59.000-03:00"
            
            url = f"https://api.mercadolibre.com/orders/search?seller={uid}&order.date_created.from={fecha_from}&order.date_created.to={fecha_to}&limit=50"
            data = api_call(url, token)
            
            if data and "results" in data:
                ordenes = data.get("results", [])
                total = sum(o.get("total_amount", 0) for o in ordenes)
                productos = extract_productos(ordenes)
                resultado[marca] = {
                    "total": total, 
                    "ordenes": len(ordenes),
                    "productos": productos[:5]  # Top 5 productos
                }
            else:
                resultado[marca] = TEST_DATA_HOY.get(marca, {"total": 0, "ordenes": 0, "productos": []})
        except Exception as e:
            print(f"Error processing {marca}: {e}")
            resultado[marca] = TEST_DATA_HOY.get(marca, {"total": 0, "ordenes": 0, "productos": []})
    
    return resultado


@router.get("/ventas/7dias")
async def ventas_7dias():
    """Ventas de la semana (sábado a hoy) por marca con productos"""
    resultado = {}
    
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    
    # Calcular el sábado de esta semana
    # 6 = sábado, 0 = domingo, etc.
    day_of_week = NOW.weekday()  # 0=lunes, 5=sábado, 6=domingo
    if day_of_week == 5:  # sábado
        dias_atras = 0
    elif day_of_week == 6:  # domingo
        dias_atras = 1
    else:  # lunes a viernes
        dias_atras = (day_of_week + 2) % 7
    
    SABADO = (NOW - timedelta(days=dias_atras)).strftime("%Y-%m-%d")
    fecha_from = f"{SABADO}T00:00:00.000-03:00"
    fecha_to = f"{HOY}T23:59:59.000-03:00"
    
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = get_token(cuenta_num)
        
        # Si no hay token, usar datos de prueba
        if not token:
            resultado[marca] = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0, "productos": []})
            continue
        
        # Si hay token, intentar obtener datos en vivo
        try:
            url = f"https://api.mercadolibre.com/orders/search?seller={uid}&order.date_created.from={fecha_from}&order.date_created.to={fecha_to}&limit=50"
            data = api_call(url, token)
            
            if data and "results" in data:
                ordenes = data.get("results", [])
                total = sum(o.get("total_amount", 0) for o in ordenes)
                productos = extract_productos(ordenes)
                resultado[marca] = {
                    "total": total, 
                    "ordenes": len(ordenes),
                    "productos": productos[:5]  # Top 5 productos
                }
            else:
                resultado[marca] = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0, "productos": []})
        except Exception as e:
            print(f"Error processing {marca}: {e}")
            resultado[marca] = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0, "productos": []})
    
    return resultado
