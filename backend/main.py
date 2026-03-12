from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ml_router.router, prefix="/api/ml", tags=["MercadoLibre"])
app.include_router(odoo_router.router, prefix="/api/odoo", tags=["Odoo"])

@app.get("/")
async def root():
    return {"status": "ok", "message": "Sobrepatas Dashboard API"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
