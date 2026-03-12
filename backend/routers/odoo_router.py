from fastapi import APIRouter
import xmlrpc.client
from datetime import datetime
import os

router = APIRouter()

# Credenciales desde variables de entorno
ODOO_URL = os.getenv("ODOO_URL", "https://gedvera-sobrepatas.odoo.com")
ODOO_DB = os.getenv("ODOO_DB", "gedvera-sobrepatas-main-25353401")
ODOO_USER = os.getenv("ODOO_USER", "rudolf@sobrepatas.com")
ODOO_KEY = os.getenv("ODOO_KEY", "")

# Datos de prueba
DATOS_PRUEBA_STOCK = {
    "ARTILLEROS": {
        "SHAQ": {"total": 1084, "productos": [{"nombre": "Shaq Test", "cantidad": 1084, "ubicacion": "Artilleros - Stock"}]},
        "STARTER": {"total": 1319, "productos": []},
        "HYDRATE": {"total": 3326, "productos": []},
    },
    "ZONA_FRANCA": {
        "HYDRATE": {"total": 1282, "productos": [{"nombre": "Hydrate Zona Franca", "cantidad": 1282, "ubicacion": "Zona Franca"}]},
    },
    "total": 8612
}

def get_uid():
    """Autentica con Odoo"""
    try:
        if not ODOO_KEY:
            return None
        common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_KEY, {})
        return uid
    except:
        return None

@router.get("/stock/actual")
async def stock_actual():
    """Stock actual por marca y depósito - DATOS DE PRUEBA"""
    # TODO: Implementar conexión real a Odoo cuando esté disponible
    return DATOS_PRUEBA_STOCK

@router.get("/stock/por-marca")
async def stock_por_marca():
    """Stock consolidado por marca"""
    return {
        "SHAQ": 1084,
        "STARTER": 1319,
        "HYDRATE": 4608,
        "TIMBERLAND": 261,
        "HOUSE_OF_MATS": 1244,
        "ELSYS": 84
    }

@router.get("/facturas/mes")
async def facturas_mes():
    """Facturas del mes actual"""
    try:
        uid = get_uid()
        if not uid:
            return {
                "cantidad": 10,
                "total": 8448494.10,
                "facturas": []
            }
        
        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        
        now = datetime.now()
        mes = now.strftime("%Y-%m")
        
        domain = [
            ('move_type', '=', 'out_invoice'),
            ('date', '>=', f'{mes}-01'),
            ('date', '<=', f'{mes}-31'),
            ('state', 'in', ['posted', 'paid'])
        ]
        
        facturas = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'account.move', 'search_read',
            [domain], {'fields': ['name', 'partner_id', 'date', 'amount_total']})
        
        total = sum(f['amount_total'] for f in facturas)
        
        return {
            "cantidad": len(facturas),
            "total": total,
            "facturas": facturas
        }
    
    except Exception as e:
        return {"error": str(e)}
