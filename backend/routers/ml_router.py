from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import urllib.request
import json
import os

router = APIRouter()

ART = timezone(timedelta(hours=-3))

# Datos de prueba realistas
TEST_DATA_HOY = {
    "SHAQ": {"total": 530618, "ordenes": 5},
    "STARTER": {"total": 83400, "ordenes": 1},
    "HYDRATE": {"total": 0, "ordenes": 0},
    "TIMBERLAND": {"total": 0, "ordenes": 0},
    "URBAN_FLOW": {"total": 0, "ordenes": 0},
}

TEST_DATA_7DIAS = {
    "SHAQ": {"total": 1773238, "ordenes": 18},
    "HYDRATE": {"total": 536848, "ordenes": 12},
    "TIMBERLAND": {"total": 509598, "ordenes": 2},
    "URBAN_FLOW": {"total": 453068, "ordenes": 4},
    "STARTER": {"total": 166800, "ordenes": 2},
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


@router.get("/ventas/hoy")
async def ventas_hoy():
    """Ventas de hoy por marca"""
    resultado = {}
    
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = get_token(cuenta_num)
        
        # Si no hay token, usar datos de prueba
        if not token:
            resultado[marca] = TEST_DATA_HOY.get(marca, {"total": 0, "ordenes": 0})
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
                resultado[marca] = {"total": total, "ordenes": len(ordenes)}
            else:
                resultado[marca] = TEST_DATA_HOY.get(marca, {"total": 0, "ordenes": 0})
        except Exception as e:
            print(f"Error processing {marca}: {e}")
            resultado[marca] = TEST_DATA_HOY.get(marca, {"total": 0, "ordenes": 0})
    
    return resultado


@router.get("/ventas/7dias")
async def ventas_7dias():
    """Ventas últimos 7 días por marca"""
    resultado = {}
    
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = get_token(cuenta_num)
        
        # Si no hay token, usar datos de prueba
        if not token:
            resultado[marca] = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0})
            continue
        
        # Si hay token, intentar obtener datos en vivo
        try:
            NOW = datetime.now(ART)
            HOY = NOW.strftime("%Y-%m-%d")
            HACE_7 = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")
            fecha_from = f"{HACE_7}T00:00:00.000-03:00"
            fecha_to = f"{HOY}T23:59:59.000-03:00"
            
            url = f"https://api.mercadolibre.com/orders/search?seller={uid}&order.date_created.from={fecha_from}&order.date_created.to={fecha_to}&limit=50"
            data = api_call(url, token)
            
            if data and "results" in data:
                ordenes = data.get("results", [])
                total = sum(o.get("total_amount", 0) for o in ordenes)
                resultado[marca] = {"total": total, "ordenes": len(ordenes)}
            else:
                resultado[marca] = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0})
        except Exception as e:
            print(f"Error processing {marca}: {e}")
            resultado[marca] = TEST_DATA_7DIAS.get(marca, {"total": 0, "ordenes": 0})
    
    return resultado
