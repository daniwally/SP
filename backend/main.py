from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
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

# SPA Middleware - sirve index.html como fallback
class SPAMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Dejar que los endpoints API funcionen
        if request.url.path.startswith("/api") or request.url.path == "/health":
            return await call_next(request)
        
        # Para el resto, intentar servir archivos estáticos
        static_dir = Path("/app/static")
        
        # Si no existe static, dejar que continúe
        if not static_dir.exists():
            return await call_next(request)
        
        file_path = static_dir / request.url.path.lstrip("/")
        
        # Si el archivo existe, servirlo
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # Si no, servir index.html (SPA)
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        
        return await call_next(request)

app.add_middleware(SPAMiddleware)
