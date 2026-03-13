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

# Servir archivos estáticos en /static
static_dir = Path("/app/static")
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# SPA fallback - servir index.html para rutas no encontradas
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Si empieza con /api, no intervenir
    if full_path.startswith("api"):
        return {"error": "not found"}
    
    # Si pide un archivo con extensión, no intervenir
    if "." in full_path.split("/")[-1]:
        return {"error": "not found"}
    
    # Para todo lo demás, servir index.html
    index_file = static_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    
    return {"error": "not found"}


