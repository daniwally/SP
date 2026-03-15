from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import urllib.request
import json
from collections import defaultdict
import os

router = APIRouter()

ART = timezone(timedelta(hours=-3))

CUENTAS = {
    1: (2389178513, "SHAQ"),
    2: (2339108379, "STARTER"),
    3: (231953468, "HYDRATE"),
    4: (1434057904, "TIMBERLAND"),
    5: (1630806191, "URBAN_FLOW"),
}

CUENTA_NAMES = {
    1: "cuenta1",
    2: "cuenta2",
    3: "cuenta3",
    4: "cuenta4",
    5: "cuenta5",
}

# ✅ REFRESH_TOKENS (válidos 6 meses) - 15/03/2026
REFRESH_TOKENS = {
    1: "TG-69b69f428dd1340001ad993d-2389178513",  # SHAQ
    2: "TG-69b69f4247245b00016c6f22-2339108379",  # STARTER
    3: "TG-69b69f43f4cf8200013075bb-231953468",   # HYDRATE
    4: "TG-69b69f4386049a000185b420-1434057904",  # TIMBERLAND
    5: "TG-69b69f43c3ae1b00019ffc91-1630806191",  # URBAN_FLOW
}

# Cache de access_tokens con timestamp
TOKEN_CACHE = {}
APP_ID = "7660452352870630"
APP_SECRET = "QEXEvr8roSZSrK0ujdccsADSqjjrgOpq"

def get_token(cuenta_num, force_refresh=False):
    """Obtiene access_token: desde cache (si es fresco) o regenera con refresh_token"""
    
    # Check cache
    if cuenta_num in TOKEN_CACHE and not force_refresh:
        cached = TOKEN_CACHE[cuenta_num]
        expires_at = cached.get("expires_at", 0)
        if datetime.now(ART).timestamp() < expires_at:
            print(f"✅ Token {cuenta_num}: FROM CACHE (valid until {cached['expires_str']})")
            return cached["token"]
    
    # Regenerar con refresh_token
    refresh_token = REFRESH_TOKENS.get(cuenta_num)
    if not refresh_token:
        print(f"❌ Token {cuenta_num}: No refresh_token available")
        return None
    
    try:
        url = "https://api.mercadolibre.com/oauth/token"
        data = f"grant_type=refresh_token&client_id={APP_ID}&client_secret={APP_SECRET}&refresh_token={refresh_token}"
        
        req = urllib.request.Request(
            url,
            data=data.encode('utf-8'),
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            token_data = json.loads(response.read().decode())
        
        access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in", 21600)  # 6 horas = 21600 seg
        
        # Cache con expiration
        expires_at = datetime.now(ART).timestamp() + expires_in - 300  # Refresh 5 min antes
        expires_str = datetime.fromtimestamp(expires_at, ART).strftime("%H:%M ART")
        
        TOKEN_CACHE[cuenta_num] = {
            "token": access_token,
            "expires_at": expires_at,
            "expires_str": expires_str
        }
        
        print(f"✅ Token {cuenta_num}: REGENERATED (valid until {expires_str})")
        return access_token
        
    except Exception as e:
        print(f"❌ Token {cuenta_num}: Refresh failed - {e}")
        return None

def api_call(url, token):
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"ML API Error: {e}")
        return None

def refresh_all_tokens():
    """Fuerza regeneración de todos los access_tokens"""
    resultado = {}
    for cuenta_num in CUENTAS.keys():
        token = get_token(cuenta_num, force_refresh=True)
        resultado[CUENTAS[cuenta_num][1]] = {
            "status": "✅ refreshed" if token else "❌ failed",
            "token": token[:50] + "..." if token else None
        }
    return resultado


@router.get("/refresh-tokens")
async def refresh_tokens_endpoint():
    """Regenera todos los access_tokens usando refresh_tokens (6 meses válidos)"""
    return refresh_all_tokens()


@router.get("/precios-actuales")
async def precios_actuales():
    """Precios actuales de ML (última orden por marca)"""
    resultado = {}
    
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = get_token(cuenta_num)
        if not token:
            resultado[marca] = {"precio": 0, "fecha": "N/A"}
            continue
        
        try:
            url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc&limit=1"
            data = api_call(url, token)
            
            if data and "results" in data and data["results"]:
                orden = data["results"][0]
                precio = orden.get("total_amount", 0)
                fecha = orden.get("date_created", "")[:10]
                resultado[marca] = {"precio": precio, "fecha": fecha}
            else:
                resultado[marca] = {"precio": 0, "fecha": "N/A"}
        except Exception as e:
            resultado[marca] = {"precio": 0, "fecha": f"Error: {str(e)[:30]}"}
    
    return resultado


@router.get("/ventas-detallado")
async def ventas_detallado():
    """Panel de TEST: Análisis detallado de ventas por período"""
    
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    HACE_7 = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")
    HACE_30 = (NOW - timedelta(days=30)).strftime("%Y-%m-%d")
    ENERO_ACTUAL = datetime(NOW.year, 1, 1).strftime("%Y-%m-%d")
    
    resultado = {
        "hoy": {},
        "semana": {},
        "mes": {},
        "año": {},
        "debug": {
            "fecha_hoy": HOY,
            "rango_7d": f"{HACE_7} a {HOY}",
            "rango_30d": f"{HACE_30} a {HOY}",
            "rango_año": f"{ENERO_ACTUAL} a {HOY}"
        }
    }
    
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = get_token(cuenta_num)
        
        if not token:
            resultado["hoy"][marca] = {"error": "Token not found"}
            continue
        
        try:
            # Traer TODAS las órdenes con paginación
            ordenes = []
            url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc"
            
            while True:
                data = api_call(url, token)
                
                if not data or "results" not in data:
                    break
                
                batch = data.get("results", [])
                ordenes.extend(batch)
                
                # Si hay scroll_id, continuar; si no, terminar
                scroll_id = data.get("paging", {}).get("scroll_id")
                if not scroll_id or len(batch) < 50:
                    break
                
                url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc&scroll_id={scroll_id}"
            
            # DEBUG: Ver estructura de primera orden
            if ordenes:
                print(f"🔍 {marca} - Primera orden: {json.dumps(ordenes[0], indent=2)[:500]}")
            else:
                print(f"⚠️ {marca}: 0 órdenes traídas, usando TEST_DATA fallback")
            
            resultado["hoy"][marca] = {
                "total": sum(o.get("total_amount", 0) for o in ordenes_hoy),
                "ordenes": len(ordenes_hoy),
                "promedio": sum(o.get("total_amount", 0) for o in ordenes_hoy) / len(ordenes_hoy) if ordenes_hoy else 0
            }
            
            resultado["semana"][marca] = {
                "total": sum(o.get("total_amount", 0) for o in ordenes_7d),
                "ordenes": len(ordenes_7d),
                "promedio": sum(o.get("total_amount", 0) for o in ordenes_7d) / len(ordenes_7d) if ordenes_7d else 0
            }
            
            resultado["mes"][marca] = {
                "total": sum(o.get("total_amount", 0) for o in ordenes_30d),
                "ordenes": len(ordenes_30d),
                "promedio": sum(o.get("total_amount", 0) for o in ordenes_30d) / len(ordenes_30d) if ordenes_30d else 0
            }
            
            resultado["año"][marca] = {
                "total": sum(o.get("total_amount", 0) for o in ordenes_año),
                "ordenes": len(ordenes_año),
                "promedio": sum(o.get("total_amount", 0) for o in ordenes_año) / len(ordenes_año) if ordenes_año else 0
            }
            
        except Exception as e:
            resultado["hoy"][marca] = {"error": str(e)}
    
    # TOTALES CONSOLIDADOS
    resultado["totales"] = {
        "hoy": {
            "total": sum(v.get("total", 0) for v in resultado["hoy"].values() if "total" in v),
            "ordenes": sum(v.get("ordenes", 0) for v in resultado["hoy"].values() if "ordenes" in v)
        },
        "semana": {
            "total": sum(v.get("total", 0) for v in resultado["semana"].values() if "total" in v),
            "ordenes": sum(v.get("ordenes", 0) for v in resultado["semana"].values() if "ordenes" in v)
        },
        "mes": {
            "total": sum(v.get("total", 0) for v in resultado["mes"].values() if "total" in v),
            "ordenes": sum(v.get("ordenes", 0) for v in resultado["mes"].values() if "ordenes" in v)
        },
        "año": {
            "total": sum(v.get("total", 0) for v in resultado["año"].values() if "total" in v),
            "ordenes": sum(v.get("ordenes", 0) for v in resultado["año"].values() if "ordenes" in v)
        }
    }
    
    return resultado
