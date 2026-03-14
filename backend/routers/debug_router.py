from fastapi import APIRouter
import urllib.request
import json

router = APIRouter()

TOKENS_HARDCODED = {
    1: "APP_USR-7660452352870630-031410-9781458a7a21ed178c8bcf93b3bcf6e2-2389178513",
    2: "APP_USR-7660452352870630-031410-479a788af15fb9b942e93a1e92b3f234-2339108379",
    3: "APP_USR-7660452352870630-031410-82dedbc765a32436d87f5c9e2f3e5678-231953468",
    4: "APP_USR-7660452352870630-031410-8f3e9f83e5b6e7ad68b9c5d1a4f7g8h9-1434057904",
    5: "APP_USR-7660452352870630-031410-1afe5aacf31b7b1a3f2e4d5c6b7a8f9g-1630806191",
}

CUENTAS = {
    1: (2389178513, "SHAQ"),
    2: (2339108379, "STARTER"),
    3: (231953468, "HYDRATE"),
    4: (1434057904, "TIMBERLAND"),
    5: (1630806191, "URBAN_FLOW"),
}

@router.get("/debug/tokens")
async def debug_tokens():
    """Verificar que los tokens están cargados"""
    return {
        "tokens_loaded": len(TOKENS_HARDCODED),
        "tokens": {num: f"{token[:40]}..." for num, token in TOKENS_HARDCODED.items()}
    }

@router.get("/debug/api-test/{cuenta_num}")
async def debug_api_test(cuenta_num: int):
    """Test de API para una cuenta específica - retorna error completo"""
    
    if cuenta_num not in TOKENS_HARDCODED:
        return {"error": f"Cuenta {cuenta_num} no existe"}
    
    token = TOKENS_HARDCODED[cuenta_num]
    uid, marca = CUENTAS[cuenta_num]
    
    resultado = {
        "cuenta": cuenta_num,
        "marca": marca,
        "uid": uid,
        "token": f"{token[:40]}...",
        "steps": []
    }
    
    # PASO 1: Verificar token
    resultado["steps"].append({"paso": "1. Token cargado", "status": "OK", "token_length": len(token)})
    
    # PASO 2: Intentar llamada simple
    url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc&limit=10"
    resultado["steps"].append({"paso": "2. URL construida", "status": "OK", "url": url})
    
    try:
        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {token}"}
        )
        resultado["steps"].append({"paso": "3. Request creado con headers", "status": "OK"})
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            resultado["steps"].append({
                "paso": "4. API respondió",
                "status": "OK",
                "http_code": response.status,
                "results_count": len(data.get("results", [])),
                "paging": data.get("paging", {})
            })
            
            # Mostrar primeras 3 órdenes
            ordenes = data.get("results", [])[:3]
            resultado["steps"].append({
                "paso": "5. Primeras órdenes",
                "status": "OK",
                "ordenes": [
                    {
                        "id": o.get("id"),
                        "fecha": o.get("date_created"),
                        "total": o.get("total_amount")
                    }
                    for o in ordenes
                ]
            })
            
            return resultado
    
    except urllib.error.HTTPError as e:
        resultado["steps"].append({
            "paso": "ERROR: HTTP Error",
            "status": "FAIL",
            "http_code": e.code,
            "reason": e.reason,
            "url": e.url,
            "body": e.read().decode() if e.fp else "No body"
        })
        return resultado
    
    except Exception as e:
        resultado["steps"].append({
            "paso": "ERROR: Exception",
            "status": "FAIL",
            "error_type": type(e).__name__,
            "error_msg": str(e)
        })
        return resultado

@router.get("/debug/all-accounts")
async def debug_all_accounts():
    """Test rápido de todas las 5 cuentas"""
    resultado = {}
    
    for cuenta_num, (uid, marca) in CUENTAS.items():
        token = TOKENS_HARDCODED[cuenta_num]
        url = f"https://api.mercadolibre.com/orders/search?seller={uid}&limit=5"
        
        try:
            req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                resultado[marca] = {
                    "status": "✅ OK",
                    "ordenes": len(data.get("results", [])),
                    "total_disponible": data.get("paging", {}).get("total", "?")
                }
        except Exception as e:
            resultado[marca] = {
                "status": "❌ FAIL",
                "error": str(e)[:100]
            }
    
    return resultado
