from fastapi import APIRouter
from datetime import datetime, timedelta, timezone
import urllib.request
import json
from collections import defaultdict

router = APIRouter()

ART = timezone(timedelta(hours=-3))

CUENTAS = {
    1: (2389178513, "SHAQ"),
    2: (2339108379, "STARTER"),
    3: (231953468, "HYDRATE"),
    4: (1434057904, "TIMBERLAND"),
    5: (1630806191, "URBAN_FLOW"),
}

# ✅ TOKENS HARDCODEADOS
TOKENS_HARDCODED = {
    1: "APP_USR-7660452352870630-031410-9781458a7a21ed178cdfe22c5288ba92-2389178513",
    2: "APP_USR-7660452352870630-031410-479a788af15fb9b942eb83c046a4b5b6-2339108379",
    3: "APP_USR-7660452352870630-031410-82dedbc765a32436d83630d1d4e5f327-231953468",
    4: "APP_USR-7660452352870630-031410-8f3e9f83e5b6e7ad68e7b6d6e3c16e94-1434057904",
    5: "APP_USR-7660452352870630-031410-1afe5aacf31b7b1a3f55e54c483d777e-1630806191",
}

def get_token(cuenta_num):
    token = TOKENS_HARDCODED.get(cuenta_num)
    if token:
        print(f"✅ Token {cuenta_num}: {token[:50]}...")
        return token
    else:
        print(f"❌ Token {cuenta_num} no encontrado")
        return None

def api_call(url, token):
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"ML API Error: {e}")
        return None


@router.get("/test/ventas-detallado")
async def ventas_detallado():
    """Panel de TEST: Análisis detallado de ventas por período"""
    
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    HACE_7 = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")
    HACE_30 = (NOW - timedelta(days=30)).strftime("%Y-%m-%d")
    HACE_365 = (NOW - timedelta(days=365)).strftime("%Y-%m-%d")
    
    resultado = {
        "hoy": {},
        "semana": {},
        "mes": {},
        "año": {},
        "debug": {
            "fecha_hoy": HOY,
            "rango_7d": f"{HACE_7} a {HOY}",
            "rango_30d": f"{HACE_30} a {HOY}",
            "rango_365d": f"{HACE_365} a {HOY}",
        }
    }
    
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = get_token(cuenta_num)
        
        if not token:
            resultado["hoy"][marca] = {"error": "Token not found"}
            continue
        
        try:
            # Traer SIN filtro (todas las órdenes)
            url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc"
            data = api_call(url, token)
            
            if not data or "results" not in data:
                resultado["hoy"][marca] = {"error": "API returned no results"}
                continue
            
            ordenes = data.get("results", [])
            
            # DEBUG: Ver estructura de primera orden
            if ordenes:
                print(f"🔍 {marca} - Primera orden: {json.dumps(ordenes[0], indent=2)[:500]}")
            
            # FILTRAR por períodos
            ordenes_hoy = [o for o in ordenes if o.get("date_created", "")[:10] == HOY]
            ordenes_7d = [o for o in ordenes if HACE_7 <= o.get("date_created", "")[:10] <= HOY]
            ordenes_30d = [o for o in ordenes if HACE_30 <= o.get("date_created", "")[:10] <= HOY]
            ordenes_365d = [o for o in ordenes if HACE_365 <= o.get("date_created", "")[:10] <= HOY]
            
            print(f"📊 {marca}: {len(ordenes)} órdenes totales | 7d: {len(ordenes_7d)} | 30d: {len(ordenes_30d)}")
            
            # CALCULAR totales
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
                "total": sum(o.get("total_amount", 0) for o in ordenes_365d),
                "ordenes": len(ordenes_365d),
                "promedio": sum(o.get("total_amount", 0) for o in ordenes_365d) / len(ordenes_365d) if ordenes_365d else 0
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
