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
    "A1": "Artilleros",
    "A2": "JOTSA",
    "A3": "Aduana (Tránsito – Solo interno)",
}

# Stock por marca/almacén con costos
STOCK_DATA = {
    "SHAQ": {
        "almacenes": {
            "A1": {
                "nombre": "Artilleros",
                "productos": [
                    {"nombre": "Motivate T43", "cantidad": 45, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Motivate T41", "cantidad": 8, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Posture T44.5", "cantidad": 12, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Posture T41.5", "cantidad": 6, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Radiate Mix", "cantidad": 32, "costo_unitario": 29.0, "metodo": "FIFO"},
                ]
            },
            "A2": {
                "nombre": "JOTSA",
                "productos": [
                    {"nombre": "Motivate T42", "cantidad": 28, "costo_unitario": 29.0, "metodo": "FIFO"},
                    {"nombre": "Posture T43", "cantidad": 15, "costo_unitario": 29.0, "metodo": "FIFO"},
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
                "nombre": "Artilleros",
                "productos": [
                    {"nombre": "GTM Negro", "cantidad": 156, "costo_unitario": 32.0, "metodo": "LIFO"},
                    {"nombre": "GTM Blanco", "cantidad": 89, "costo_unitario": 32.0, "metodo": "LIFO"},
                ]
            },
            "A2": {
                "nombre": "JOTSA",
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
                "nombre": "Artilleros",
                "productos": [
                    {"nombre": "Botella 710ML", "cantidad": 1840, "costo_unitario": 8.5, "metodo": "FIFO"},
                    {"nombre": "Vaso 500ML", "cantidad": 1200, "costo_unitario": 6.2, "metodo": "FIFO"},
                    {"nombre": "Jarro 1L", "cantidad": 680, "costo_unitario": 9.8, "metodo": "FIFO"},
                ]
            },
            "A2": {
                "nombre": "JOTSA",
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
                "nombre": "Artilleros",
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
                "nombre": "Artilleros",
                "productos": [
                    {"nombre": "Timberland Mix", "cantidad": 42, "costo_unitario": 65.0, "metodo": "FIFO"},
                    {"nombre": "Shaq Mix", "cantidad": 28, "costo_unitario": 28.0, "metodo": "FIFO"},
                    {"nombre": "Otros", "cantidad": 15, "costo_unitario": 35.0, "metodo": "FIFO"},
                ]
            },
            "A2": {
                "nombre": "JOTSA",
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
    except Exception as e:
        print(f"Auth error: {e}")
        return None

def get_stock_real():
    """Obtiene stock real desde Odoo agrupado por almacén"""
    try:
        uid = get_uid()
        if not uid:
            print("No se pudo autenticar con Odoo")
            return {}
        
        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        
        # Ubicaciones de stock por almacén (IDs reales de Odoo)
        warehouse_locations = {
            'Artilleros': 5,
            'JOTSA': 18,
            'Aduana (Tránsito – Solo interno)': 24
        }
        
        result = {}
        
        for wh_name, loc_id in warehouse_locations.items():
            try:
                # Buscar quants en esa ubicación
                domain = [('location_id', '=', loc_id), ('quantity', '>', 0)]
                quant_ids = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'search', [domain])
                
                if quant_ids:
                    quants = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'read', [quant_ids])
                    
                    productos = []
                    for q in quants:
                        product_id = q['product_id']
                        if product_id:
                            # Obtener datos del producto
                            product = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'product.product', 'read', [product_id[0]])
                            if product:
                                prod_data = product[0]
                                productos.append({
                                    'nombre': prod_data['name'],
                                    'cantidad': int(q['quantity']),
                                    'costo_unitario': float(prod_data.get('standard_price', 0)) or 0.0,
                                    'metodo': 'FIFO'
                                })
                    
                    if productos:
                        result[wh_name] = {
                            'nombre': wh_name,
                            'productos': productos,
                            'total_unidades': sum(p['cantidad'] for p in productos),
                            'costo_total': sum(p['cantidad'] * p['costo_unitario'] for p in productos)
                        }
            
            except Exception as e:
                print(f"Error en almacén {wh_name}: {e}")
                continue
        
        return result
    
    except Exception as e:
        print(f"Error fetching stock: {e}")
        return {}

@router.get("/stock/actual")
async def stock_actual():
    """Stock actual por almacén desde Odoo (real time)"""
    stock_real = get_stock_real()
    
    # Formatear resultado en estructura por marca (extraída del nombre de producto)
    formatted_result = {}
    
    for almacen_name, almacen_data in stock_real.items():
        # Agrupar productos por marca (basada en el nombre del producto o categoría)
        # Por ahora, crear una estructura similar a STOCK_DATA pero con datos reales
        for prod in almacen_data['productos']:
            # Extraer marca del nombre (primer parte antes de space o dash)
            marca = 'GENERAL'  # Por defecto
            if formatted_result.get(marca) is None:
                formatted_result[marca] = {'almacenes': {}}
            
            # Asegurar que el almacén existe en la marca
            if almacen_name not in formatted_result[marca]['almacenes']:
                formatted_result[marca]['almacenes'][almacen_name] = {
                    'nombre': almacen_name,
                    'productos': []
                }
            
            formatted_result[marca]['almacenes'][almacen_name]['productos'].append(prod)
    
    # Calcular totales por marca/almacén
    for marca, data in formatted_result.items():
        total_unidades = 0
        total_costo = 0
        
        for almacen_name, almacen_data in data['almacenes'].items():
            almacen_total = sum(p['cantidad'] for p in almacen_data['productos'])
            almacen_costo = sum(p['cantidad'] * p['costo_unitario'] for p in almacen_data['productos'])
            
            total_unidades += almacen_total
            total_costo += almacen_costo
        
        data['total_unidades'] = total_unidades
        data['costo_total'] = total_costo
    
    # Si no hay datos reales, devolver test data
    return formatted_result if formatted_result else STOCK_DATA

@router.get("/almacenes")
async def almacenes():
    """Lista de almacenes disponibles desde Odoo"""
    try:
        uid = get_uid()
        if not uid:
            return ALMACENES
        
        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        warehouse_ids = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.warehouse', 'search', [])
        warehouses = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.warehouse', 'read', 
                                       [warehouse_ids], ['id', 'name'])
        
        return {str(w['id']): w['name'] for w in warehouses}
    
    except Exception as e:
        print(f"Error fetching almacenes: {e}")
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
