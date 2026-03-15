from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from pathlib import Path
from contextlib import asynccontextmanager
import urllib.request
import json

from routers import ml_router, odoo_router, valuation_router, test_router
from database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="Sobrepatas Dashboard API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers API
app.include_router(ml_router.router, prefix="/api/ml", tags=["MercadoLibre"])
app.include_router(odoo_router.router, prefix="/api/odoo", tags=["Odoo"])
app.include_router(valuation_router.router, tags=["Valuation"])
app.include_router(test_router.router, prefix="/api/test", tags=["Test"])

# DEBUG ENDPOINTS DIRECTAMENTE EN MAIN
TOKENS_DEBUG = {
    1: "APP_USR-7660452352870630-031400-50a338ae07bd2731123c716b20fa2269-2389178513",
    2: "APP_USR-7660452352870630-031400-8e3e08784d7d3c2a8ede4d6fed821db5-2339108379",
    3: "APP_USR-7660452352870630-031323-ad0383c9d33588f095546dff4059d22e-231953468",
    4: "APP_USR-7660452352870630-031400-f5bdd3f7cffbef04777fd2e48891fda0-1434057904",
    5: "APP_USR-7660452352870630-031400-a00b56f29940c93ae2d3c0d164761155-1630806191",
}

CUENTAS_DEBUG = {
    1: (2389178513, "SHAQ"),
    2: (2339108379, "STARTER"),
    3: (231953468, "HYDRATE"),
    4: (1434057904, "TIMBERLAND"),
    5: (1630806191, "URBAN_FLOW"),
}

@app.get("/api/debug/tokens")
async def debug_tokens():
    return {
        "tokens_loaded": len(TOKENS_DEBUG),
        "tokens": {num: f"{token[:40]}..." for num, token in TOKENS_DEBUG.items()}
    }

@app.get("/api/debug/all-accounts")
async def debug_all_accounts():
    resultado = {}
    for cuenta_num, (uid, marca) in CUENTAS_DEBUG.items():
        token = TOKENS_DEBUG[cuenta_num]
        url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc"
        try:
            req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                resultado[marca] = {
                    "status": "✅ OK",
                    "total_ordenes": data.get("paging", {}).get("total", 0)
                }
        except Exception as e:
            resultado[marca] = {
                "status": "❌ FAIL",
                "error": str(e)[:100]
            }
    return resultado

@app.get("/api/debug/api-test/{cuenta_num}")
async def debug_api_test(cuenta_num: int):
    if cuenta_num not in TOKENS_DEBUG:
        return {"error": f"Cuenta {cuenta_num} no existe"}
    
    token = TOKENS_DEBUG[cuenta_num]
    uid, marca = CUENTAS_DEBUG[cuenta_num]
    
    resultado = {
        "cuenta": cuenta_num,
        "marca": marca,
        "uid": uid,
        "token": f"{token[:40]}...",
        "steps": []
    }
    
    url = f"https://api.mercadolibre.com/orders/search?seller={uid}&sort=date_desc&limit=10"
    resultado["steps"].append({"paso": "1. Token cargado", "status": "OK", "token_length": len(token)})
    resultado["steps"].append({"paso": "2. URL construida", "status": "OK", "url": url})
    
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
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
            
            ordenes = data.get("results", [])[:3]
            resultado["steps"].append({
                "paso": "5. Primeras 3 órdenes",
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
            "url": e.url
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

# Rutas base
@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.3.2", "updated": "2026-03-13 12:05"}

@app.get("/api")
async def api_info():
    return {"status": "ok"}

# Servir archivos estáticos (SPA + assets)
static_dir = Path("/app/static")
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


