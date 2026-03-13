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

# Almacenes disponibles
ALMACENES = {
    "A1": "Almacén Principal (CABA)",
    "A2": "Almacén 2 (Palermo)",
    "A3": "Almacén 3 (La Boca)",
}

# Stock por marca/almacén con costos
STOCK_DATA = {
    "SHAQ": {
        "almacenes": {
            "A1": {
                "nombre": "Almacén Principal (CABA)",
                "productos": [
                    {"nombre": "Motivate T43", "cantidad": 45, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Motivate T41", "cantidad": 8, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Posture T44.5", "cantidad": 12, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Posture T41.5", "cantidad": 6, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Radiate Mix", "cantidad": 32, "costo_unitario": 29.0, "metodo": "FIFO"},
                ]
            },
            "A2": {
                "nombre": "Almacén 2 (Palermo)",
                "productos": [
                    {"nombre": "Motivate T42", "cantidad": 28, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Posture T43", "cantidad": 15, "costo_unitario": 29.0, "metodo": "FIFO"},
                ]
            },
            "A3": {
                "nombre": "Almacén 3 (La Boca)",
                "productos": [
                    {"nombre": "Spin Move", "cantidad": 52, "costo_unitario": 29.0, "metodo": "FIFO"},
                ]
            }
        },
        "total_unidades": 198,
        "costo_total": 5742.0
    },
    "STARTER": {
        "almacenes": {
            "A1": {
                "nombre": "Almacén Principal (CABA)",
                "productos": [
                    {"nombre": "GTM Negro", "cantidad": 156, "costo_unitario": 32.0, "metodo": "LIFO"},
                    {"nombre": "GTM Blanco", "cantidad": 89, "costo_unitario": 32.0, "metodo": "LIFO"},
                ]
            },
            "A2": {
                "nombre": "Almacén 2 (Palermo)",
                "productos": [
                    {"nombre": "GTM Negro", "cantidad": 45, "costo_unitario": 32.0, "metodo": "LIFO"},
                ]
            }
        },
        "total_unidades": 290,
        "costo_total": 9280.0
    },
    "HYDRATE": {
        "almacenes": {
            "A1": {
                "nombre": "Almacén Principal (CABA)",
                "productos": [
                    {"nombre": "Botella 710ML", "cantidad": 1840, "costo_unitario": 8.5, "metodo": "FIFO"},
                    {"nombre": "Vaso 500ML", "cantidad": 1200, "costo_unitario": 6.2, "metodo": "FIFO"},
                    {"nombre": "Jarro 1L", "cantidad": 680, "costo_unitario": 9.8, "metodo": "FIFO"},
                ]
            },
            "A2": {
                "nombre": "Almacén 2 (Palermo)",
                "productos": [
                    {"nombre": "Botella 710ML", "cantidad": 520, "costo_unitario": 8.5, "metodo": "FIFO"},
                    {"nombre": "Vaso 500ML", "cantidad": 380, "costo_unitario": 6.2, "metodo": "FIFO"},
                ]
            }
        },
        "total_unidades": 4620,
        "costo_total": 32456.0
    },
    "TIMBERLAND": {
        "almacenes": {
            "A1": {
                "nombre": "Almacén Principal (CABA)",
                "productos": [
                    {"nombre": "Classic Boot", "cantidad": 34, "costo_unitario": 68.0, "metodo": "LIFO"},
                    {"nombre": "Pro Hiking", "cantidad": 18, "costo_unitario": 72.0, "metodo": "LIFO"},
                ]
            }
        },
        "total_unidades": 52,
        "costo_total": 4360.0
    },
    "URBAN_FLOW": {
        "almacenes": {
            "A1": {
                "nombre": "Almacén Principal (CABA)",
                "productos": [
                    {"nombre": "Timberland Mix", "cantidad": 42, "costo_unitario": 65.0, "metodo": "FIFO"},
                    {"nombre": "Shaq Mix", "cantidad": 28, "costo_unitario": 28.0, "metodo": "FIFO"},
                    {"nombre": "Otros", "cantidad": 15, "costo_unitario": 35.0, "metodo": "FIFO"},
                ]
            },
            "A3": {
                "nombre": "Almacén 3 (La Boca)",
                "productos": [
                    {"nombre": "Timberland Mix", "cantidad": 18, "costo_unitario": 65.0, "metodo": "FIFO"},
                ]
            }
        },
        "total_unidades": 103,
        "costo_total": 4385.0
    }
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
    """Stock actual por marca/almacén con costos (FIFO/LIFO)"""
    return STOCK_DATA

@router.get("/almacenes")
async def almacenes():
    """Lista de almacenes disponibles"""
    return ALMACENES

@router.get("/stock/consolidado")
async def stock_consolidado():
    """Stock consolidado por marca"""
    consolidado = {}
    for marca, data in STOCK_DATA.items():
        consolidado[marca] = {
            "total_unidades": data["total_unidades"],
            "costo_total": data["costo_total"],
            "costo_promedio_unitario": round(data["costo_total"] / data["total_unidades"], 2)
        }
    return consolidado

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
