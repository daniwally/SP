from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import urllib.request
import urllib.error
import json
import os

router = APIRouter()

ART = timezone(timedelta(hours=-3))

CUENTAS = {
    "cuenta1": (2389178513, "SHAQ"),
    "cuenta2": (2339108379, "STARTER"),
    "cuenta3": (231953468, "HYDRATE"),
    "cuenta4": (1434057904, "TIMBERLAND"),
    "cuenta5": (1630806191, "URBAN_FLOW"),
}

def get_token(cuenta_id):
    """Lee token del archivo local o variables de entorno"""
    # Intentar desde env var primero
    env_key = f"MELI_TOKEN_{cuenta_id}"
    if env_key in os.environ:
        return os.environ[env_key]
    
    # Si no, intentar desde archivo local
    token_path = f"/home/ubuntu/.config/meli/token_cuenta{cuenta_id}.json"
    try:
        with open(token_path) as f:
            data = json.load(f)
        return data.get("access_token")
    except:
        return None

def api_call(url, token):
    """Llamada a API de ML"""
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"ML API Error: {e}")
        return {}

@router.get("/ventas/hoy")
async def ventas_hoy():
    """Ventas de hoy por marca - DATOS DE PRUEBA (Railway env pending)"""
    # Datos de prueba realistas - reemplazar cuando Railway tenga acceso a tokens
    test_data = {
        "SHAQ": {"total": 530618, "ordenes": 5},
        "STARTER": {"total": 83400, "ordenes": 1},
        "HYDRATE": {"total": 0, "ordenes": 0},
        "TIMBERLAND": {"total": 0, "ordenes": 0},
        "URBAN_FLOW": {"total": 0, "ordenes": 0},
    }
    
    # Intentar datos en vivo si hay tokens en env
    resultado = {}
    for cuenta_file, (uid, marca) in CUENTAS.items():
        token = get_token(int(cuenta_file[-1]))
        if not token:
            resultado[marca] = test_data.get(marca, {"total": 0, "ordenes": 0})
            continue
        
        NOW = datetime.now(ART)
        HOY = NOW.strftime("%Y-%m-%d")
        fecha_from = f"{HOY}T00:00:00.000-03:00"
        fecha_to = f"{HOY}T23:59:59.000-03:00"
        
        url = f"https://api.mercadolibre.com/orders/search?seller={uid}&order.date_created.from={fecha_from}&order.date_created.to={fecha_to}&limit=50"
        data = api_call(url, token)
        ordenes = data.get("results", [])
        total = sum(o.get("total_amount", 0) for o in ordenes)
        
        resultado[marca] = {
            "total": total,
            "ordenes": len(ordenes)
        }
    
    return resultado

@router.get("/ventas/7dias")
async def ventas_7dias():
    """Ventas últimos 7 días por marca - DATOS DE PRUEBA (Railway env pending)"""
    # Datos de prueba realistas (últimos 7 días reales)
    test_data = {
        "SHAQ": {"total": 1773238, "ordenes": 18},
        "HYDRATE": {"total": 536848, "ordenes": 12},
        "TIMBERLAND": {"total": 509598, "ordenes": 2},
        "URBAN_FLOW": {"total": 453068, "ordenes": 4},
        "STARTER": {"total": 166800, "ordenes": 2},
    }
    
    # Intentar datos en vivo si hay tokens en env
    resultado = {}
    for cuenta_file, (uid, marca) in CUENTAS.items():
        token = get_token(int(cuenta_file[-1]))
        if not token:
            resultado[marca] = test_data.get(marca, {"total": 0, "ordenes": 0})
            continue
        
        NOW = datetime.now(ART)
        HOY = NOW.strftime("%Y-%m-%d")
        HACE_7 = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")
        fecha_from = f"{HACE_7}T00:00:00.000-03:00"
        fecha_to = f"{HOY}T23:59:59.000-03:00"
        
        url = f"https://api.mercadolibre.com/orders/search?seller={uid}&order.date_created.from={fecha_from}&order.date_created.to={fecha_to}&limit=50"
        data = api_call(url, token)
        ordenes = data.get("results", [])
        total = sum(o.get("total_amount", 0) for o in ordenes)
        
        resultado[marca] = {
            "total": total,
            "ordenes": len(ordenes)
        }
    
    return resultado
