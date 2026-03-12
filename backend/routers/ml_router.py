from fastapi import APIRouter
from datetime import datetime, timedelta, timezone

router = APIRouter()

ART = timezone(timedelta(hours=-3))

# Datos de prueba - reemplazar con API real cuando se configure token access
DATOS_PRUEBA_7DIAS = {
    "SHAQ": {"total": 1773238.5, "ordenes": 18},
    "STARTER": {"total": 166800, "ordenes": 2},
    "HYDRATE": {"total": 536848, "ordenes": 12},
    "TIMBERLAND": {"total": 509598, "ordenes": 2},
    "URBAN_FLOW": {"total": 453068, "ordenes": 4},
}

@router.get("/ventas/hoy")
async def ventas_hoy():
    """Ventas de hoy por marca"""
    NOW = datetime.now(ART)
    HOY = NOW.strftime("%Y-%m-%d")
    
    # TODO: Implementar con tokens de ML desde variables de entorno
    return {
        "SHAQ": {"total": 0, "ordenes": 0},
        "STARTER": {"total": 0, "ordenes": 0},
        "HYDRATE": {"total": 0, "ordenes": 0},
        "TIMBERLAND": {"total": 0, "ordenes": 0},
        "URBAN_FLOW": {"total": 0, "ordenes": 0},
        "fecha": HOY
    }

@router.get("/ventas/7dias")
async def ventas_7dias():
    """Ventas últimos 7 días por marca - DATOS DE PRUEBA"""
    return DATOS_PRUEBA_7DIAS
