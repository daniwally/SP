from fastapi import APIRouter
import xmlrpc.client
from datetime import datetime

router = APIRouter()

ODOO_URL = "https://gedvera-sobrepatas.odoo.com"
ODOO_DB = "gedvera-sobrepatas-main-25353401"
ODOO_USER = "rudolf@sobrepatas.com"
ODOO_KEY = "0115ec6a78f7a7329a152fe95f41b8152a22f4b9"

def get_uid():
    """Autentica con Odoo"""
    try:
        common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_KEY, {})
        return uid
    except:
        return None

def get_models():
    """Retorna objeto de modelos"""
    return xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

@router.get("/stock/actual")
async def stock_actual():
    """Stock actual por marca y depósito (Artilleros + Zona Franca)"""
    try:
        uid = get_uid()
        if not uid:
            return {"error": "Odoo auth failed"}
        
        models = get_models()
        
        # Búsqueda de stock.quant con stock > 0
        domain = [('quantity', '>', 0)]
        quants = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'search_read', 
            [domain], {
                'fields': ['product_id', 'location_id', 'quantity', 'product_id.x_studio_marca'],
                'limit': 500
            })
        
        resultado = {
            "ARTILLEROS": {},
            "ZONA_FRANCA": {},
            "total": 0
        }
        
        for quant in quants:
            try:
                product_name = quant.get('product_id', [None, 'Unknown'])[1]
                location_name = quant.get('location_id', [None, 'Unknown'])[1]
                qty = quant.get('quantity', 0)
                marca = quant.get('product_id.x_studio_marca', 'SIN_MARCA')
                
                # Clasificar por depósito
                deposito = "ARTILLEROS"
                if "zona franca" in location_name.lower() or "aduana" in location_name.lower():
                    deposito = "ZONA_FRANCA"
                
                if marca not in resultado[deposito]:
                    resultado[deposito][marca] = {
                        "total": 0,
                        "productos": []
                    }
                
                resultado[deposito][marca]["total"] += qty
                resultado[deposito][marca]["productos"].append({
                    "nombre": product_name,
                    "cantidad": qty,
                    "ubicacion": location_name
                })
                
                resultado["total"] += qty
            except:
                continue
        
        return resultado
    
    except Exception as e:
        return {"error": str(e)}

@router.get("/stock/por-marca")
async def stock_por_marca():
    """Stock consolidado por marca"""
    try:
        uid = get_uid()
        if not uid:
            return {"error": "Odoo auth failed"}
        
        models = get_models()
        
        domain = [('quantity', '>', 0)]
        quants = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'search_read', 
            [domain], {
                'fields': ['product_id', 'quantity', 'product_id.x_studio_marca'],
                'limit': 500
            })
        
        resultado = {}
        
        for quant in quants:
            try:
                marca = quant.get('product_id.x_studio_marca', 'SIN_MARCA')
                qty = quant.get('quantity', 0)
                
                if marca not in resultado:
                    resultado[marca] = 0
                
                resultado[marca] += qty
            except:
                continue
        
        return resultado
    
    except Exception as e:
        return {"error": str(e)}

@router.get("/facturas/mes")
async def facturas_mes():
    """Facturas del mes actual"""
    try:
        uid = get_uid()
        if not uid:
            return {"error": "Odoo auth failed"}
        
        models = get_models()
        
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
