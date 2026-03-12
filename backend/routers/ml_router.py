from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import urllib.request
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
    token_path = f"/home/ubuntu/.config/meli/token_cuenta{cuenta_id}.json"
    try:
        with open(token_path) as f:
            data = json.load(f)
        return data.get("access_token")
    except:
        return None

def api_call(url, token):
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except:
        return {}

@router.get("/ventas/hoy")
async def ventas_hoy():
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    fecha_from = f"{HOY}T00:00:00.000-03:00"
    fecha_to = f"{HOY}T23:59:59.000-03:00"
    
    resultado = {}
    
    for cuenta_file, (uid, marca) in CUENTAS.items():
        token = get_token(int(cuenta_file[-1]))
        if not token:
            resultado[marca] = {"total": 0, "ordenes": 0}
            continue
        
        url = f"https://api.mercadolibre.com/orders/search?seller={uid}&order.date_created.from={fecha_from}&order.date_created.to={fecha_to}&limit=50"
        data = api_call(url, token)
        ordenes = data.get("results", [])
        total = sum(o.get("total_amount", 0) for o in ordenes)
        
        resultado[marca] = {"total": total, "ordenes": len(ordenes)}
    
    return resultado

@router.get("/ventas/7dias")
async def ventas_7dias():
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    HACE_7 = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")
    fecha_from = f"{HACE_7}T00:00:00.000-03:00"
    fecha_to = f"{HOY}T23:59:59.000-03:00"
    
    resultado = {}
    
    for cuenta_file, (uid, marca) in CUENTAS.items():
        token = get_token(int(cuenta_file[-1]))
        if not token:
            resultado[marca] = {"total": 0, "ordenes": 0}
            continue
        
        url = f"https://api.mercadolibre.com/orders/search?seller={uid}&order.date_created.from={fecha_from}&order.date_created.to={fecha_to}&limit=50"
        data = api_call(url, token)
        ordenes = data.get("results", [])
        total = sum(o.get("total_amount", 0) for o in ordenes)
        
        resultado[marca] = {"total": total, "ordenes": len(ordenes)}
    
    return resultado
