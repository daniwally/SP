"""
Router para obtener métricas de publicaciones desde ML API
Título, Descripción, Categoría, Precio, Stock, Vendidas, Listing Type
"""

from fastapi import APIRouter, HTTPException
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List

router = APIRouter(prefix="/api/publicaciones", tags=["publicaciones"])

# Importar config de tokens (mismo que ml_router.py usa)
try:
    with open("backend/config_tokens.json") as f:
        CONFIG = json.load(f)
except:
    CONFIG = {}

REFRESH_TOKENS = CONFIG.get("REFRESH_TOKENS", {})
APP_ID = CONFIG.get("APP_ID", "7660452352870630")
APP_SECRET = CONFIG.get("APP_SECRET", "QEXEvr8roSZSrK0ujdccsADSqjjrgOpq")

# Mapeo de marcas a UIDs
MARCAS = {
    "SHAQ": 2389178513,
    "STARTER": 2339108379,
    "HYDRATE": 231953468,
    "TIMBERLAND": 1434057904,
    "URBAN_FLOW": 1630806191,
}

def get_token(marca: str):
    """Obtener access token para una marca"""
    try:
        refresh_token = REFRESH_TOKENS.get(marca)
        if not refresh_token:
            return None
        
        r = requests.post(
            "https://api.mercadolibre.com/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": APP_ID,
                "client_secret": APP_SECRET,
                "refresh_token": refresh_token,
            },
            timeout=10
        )
        if r.status_code == 200:
            return r.json().get("access_token")
        return None
    except:
        return None

def get_listings(marca: str, token: str) -> List[Dict]:
    """Obtener listings activos de una marca"""
    try:
        uid = MARCAS.get(marca)
        if not uid:
            return []
        
        r = requests.get(
            f"https://api.mercadolibre.com/users/{uid}/listings/active",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if r.status_code == 200:
            return r.json()
        return []
    except:
        return []

def get_item_details(item_id: str, token: str) -> Dict:
    """Obtener detalles de un item"""
    try:
        r = requests.get(
            f"https://api.mercadolibre.com/items/{item_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if r.status_code == 200:
            return r.json()
        return {}
    except:
        return {}

@router.get("/por-marca/{marca}")
async def publicaciones_por_marca(marca: str):
    """Obtener publicaciones de una marca con métricas"""
    
    marca = marca.upper()
    if marca not in MARCAS:
        raise HTTPException(status_code=400, detail=f"Marca no válida: {marca}")
    
    token = get_token(marca)
    if not token:
        return {"error": f"No se pudo autenticar para {marca}", "publicaciones": []}
    
    # Obtener listings
    listings = get_listings(marca, token)
    
    publicaciones = []
    for item_id in listings:
        details = get_item_details(item_id, token)
        
        if details:
            publi = {
                "item_id": item_id,
                "titulo": details.get("title", "N/A"),
                "descripcion": details.get("description", "")[:100] + "..." if details.get("description") else "N/A",
                "categoria": details.get("category_id", "N/A"),
                "precio": details.get("price", 0),
                "stock": details.get("available_quantity", 0),
                "vendidas": details.get("sold_quantity", 0),
                "listing_type": details.get("listing_type_id", "N/A"),
                "url": f"https://mercadolibre.com.ar/p/{item_id}",
                "thumbnail": details.get("thumbnail", "")
            }
            publicaciones.append(publi)
    
    return {
        "marca": marca,
        "timestamp": datetime.now().isoformat(),
        "total": len(publicaciones),
        "publicaciones": publicaciones
    }

@router.get("/todas")
async def publicaciones_todas():
    """Obtener publicaciones de TODAS las marcas"""
    
    resultado = {}
    
    for marca in MARCAS.keys():
        token = get_token(marca)
        if not token:
            resultado[marca] = {"error": "Sin autenticación", "publicaciones": []}
            continue
        
        listings = get_listings(marca, token)
        publicaciones = []
        
        for item_id in listings[:20]:  # Limitar a 20 por marca para no saturar
            details = get_item_details(item_id, token)
            if details:
                publi = {
                    "item_id": item_id,
                    "titulo": details.get("title", "N/A"),
                    "precio": details.get("price", 0),
                    "stock": details.get("available_quantity", 0),
                    "vendidas": details.get("sold_quantity", 0),
                }
                publicaciones.append(publi)
        
        resultado[marca] = {
            "total": len(publicaciones),
            "publicaciones": publicaciones
        }
    
    return {
        "timestamp": datetime.now().isoformat(),
        "datos": resultado
    }

@router.get("/consolidado")
async def publicaciones_consolidado():
    """Resumen consolidado: stock + vendidas por marca"""
    
    resultado = {}
    
    for marca in MARCAS.keys():
        token = get_token(marca)
        if not token:
            continue
        
        listings = get_listings(marca, token)
        
        total_stock = 0
        total_vendidas = 0
        
        for item_id in listings:
            details = get_item_details(item_id, token)
            if details:
                total_stock += details.get("available_quantity", 0)
                total_vendidas += details.get("sold_quantity", 0)
        
        resultado[marca] = {
            "stock_total": total_stock,
            "vendidas_total": total_vendidas,
            "publicaciones_activas": len(listings)
        }
    
    return {
        "timestamp": datetime.now().isoformat(),
        "consolidado": resultado
    }
