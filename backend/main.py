from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from pathlib import Path
from contextlib import asynccontextmanager

from routers import ml_router, odoo_router
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

# Rutas base
@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/api")
async def api_info():
    return {"status": "ok"}

# Servir archivos estáticos (SPA + assets)
static_dir = Path("/app/static")
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


