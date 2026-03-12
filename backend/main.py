from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from routers import ml_router, odoo_router
from database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="Sobrepatas Dashboard API",
    description="API para dashboard de ventas y stock",
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

# Health check
@app.get("/")
async def root():
    return {"status": "ok", "message": "Sobrepatas Dashboard API"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Servir frontend estático
static_dir = os.path.join(os.path.dirname(__file__), '..', 'static')
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
