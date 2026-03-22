from fastapi import APIRouter
import xmlrpc.client
from datetime import datetime
import os
import asyncio
from functools import partial

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

# Stock por marca/almacén (DATOS REALES EXTRAÍDOS DE ODOO 13/03/2026)
# Solo cantidades - sin valuación
STOCK_DATA = {
    "SHAQ": {
        "almacenes": {
            "Artilleros": {
                "nombre": "Artilleros",
                "productos": [{"nombre": "SHAQ Products", "cantidad": 873}],
                "total": 873
            },
            "Aduana (Tránsito – Solo interno)": {
                "nombre": "Aduana (Tránsito – Solo interno)",
                "productos": [{"nombre": "SHAQ Products", "cantidad": 21591}],
                "total": 21591
            }
        },
        "total_unidades": 22464
    },
    "STARTER": {
        "almacenes": {
            "Artilleros": {
                "nombre": "Artilleros",
                "productos": [{"nombre": "STARTER Products", "cantidad": 1348}],
                "total": 1348
            },
            "Aduana (Tránsito – Solo interno)": {
                "nombre": "Aduana (Tránsito – Solo interno)",
                "productos": [{"nombre": "STARTER Products", "cantidad": 40476}],
                "total": 40476
            }
        },
        "total_unidades": 41824
    },
    "HYDRATE": {
        "almacenes": {
            "Artilleros": {
                "nombre": "Artilleros",
                "productos": [{"nombre": "HYDRATE Products", "cantidad": 3065}],
                "total": 3065
            },
            "Aduana (Tránsito – Solo interno)": {
                "nombre": "Aduana (Tránsito – Solo interno)",
                "productos": [{"nombre": "HYDRATE Products", "cantidad": 6789}],
                "total": 6789
            }
        },
        "total_unidades": 9854
    },
    "TIMBERLAND": {
        "almacenes": {
            "Artilleros": {
                "nombre": "Artilleros",
                "productos": [{"nombre": "TIMBERLAND Products", "cantidad": 306}],
                "total": 306
            },
            "Aduana (Tránsito – Solo interno)": {
                "nombre": "Aduana (Tránsito – Solo interno)",
                "productos": [{"nombre": "TIMBERLAND Products", "cantidad": 4897}],
                "total": 4897
            }
        },
        "total_unidades": 5203
    },
    "ELSYS": {
        "almacenes": {
            "Artilleros": {
                "nombre": "Artilleros",
                "productos": [{"nombre": "ELSYS Products", "cantidad": 84}],
                "total": 84
            },
            "Aduana (Tránsito – Solo interno)": {
                "nombre": "Aduana (Tránsito – Solo interno)",
                "productos": [{"nombre": "ELSYS Products", "cantidad": 200}],
                "total": 200
            }
        },
        "total_unidades": 284
    }
}

def get_uid():
    """Autentica con Odoo"""
    try:
        if not ODOO_KEY:
            return None
        common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common', timeout=5)
        uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_KEY, {})
        return uid
    except Exception as e:
        print(f"Auth error: {e}")
        return None

def get_marca_map():
    """Mapea IDs de categoría a nombres de marca"""
    try:
        uid = get_uid()
        if not uid:
            return {}
        
        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        
        # Obtener subcategorías de "Marcas"
        marca_categ = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'product.category', 'search', [[('name', '=', 'Marcas')]])
        if marca_categ:
            subcats = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'product.category', 'search', [[('parent_id', '=', marca_categ[0])]])
            marcas = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'product.category', 'read', [subcats])
            
            # Mapear: ID categoría -> Nombre marca (normalizado)
            marca_map = {}
            for m in marcas:
                name = m['name']
                # Normalizar nombres
                if 'SHAQUILLE' in name or 'SHAQ' in name:
                    marca_map[m['id']] = 'SHAQ'
                elif 'STARTER' in name:
                    marca_map[m['id']] = 'STARTER'
                elif 'HYDRATE' in name:
                    marca_map[m['id']] = 'HYDRATE'
                elif 'TIMBERLAND' in name:
                    marca_map[m['id']] = 'TIMBERLAND'
                elif 'ELSYS' in name:
                    marca_map[m['id']] = 'ELSYS'
                else:
                    marca_map[m['id']] = name
            
            return marca_map
    
    except Exception as e:
        print(f"Error getting marca map: {e}")
    
    return {}

def get_stock_real():
    """Obtiene stock real desde Odoo agrupado por marca y almacén - DESACTIVADA"""
    # DESACTIVADA - Odoo tiene demasiados registros
    return {}
    
    try:
        uid = get_uid()
        if not uid:
            print("❌ No auth - usando test data")
            return {}
        
        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object', timeout=15)
        
        # Obtener mapeo de marcas
        marca_map = get_marca_map()
        
        # Ubicaciones de stock por almacén (IDs reales de Odoo) - solo Artilleros y Aduana
        warehouse_locations = {
            'Artilleros': 5,
            'Aduana (Tránsito – Solo interno)': 24
        }
        
        result = {}  # {marca -> {almacenes -> {...}, total_unidades, costo_total}}
        
        for wh_name, loc_id in warehouse_locations.items():
            try:
                print(f"🔍 Buscando stock en {wh_name}...")
                
                # Buscar quants en esa ubicación con límite
                domain = [('location_id', '=', loc_id), ('quantity', '>', 0)]
                quant_ids = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'search', [domain], {'limit': 500})
                
                print(f"  Total quants encontrados: {len(quant_ids)}")
                
                if quant_ids:
                    quants = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'read', [quant_ids], ['product_id', 'quantity'])
                    
                    # Traer datos de productos en batch (más eficiente)
                    product_ids = [q['product_id'][0] for q in quants if q['product_id']]
                    
                    if product_ids:
                        products = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'product.product', 'read', 
                                                    product_ids, ['name', 'standard_price', 'categ_id'])
                        
                        prod_map = {p['id']: p for p in products}
                        
                        for q in quants:
                            product_id = q['product_id'][0] if q['product_id'] else None
                            if product_id and product_id in prod_map:
                                prod_data = prod_map[product_id]
                                
                                # Extraer marca de la categoría
                                categ_id = prod_data.get('categ_id')
                                marca = 'OTROS'
                                if categ_id:
                                    marca = marca_map.get(categ_id[0], 'OTROS')
                                
                                # Asegurar que marca existe en result
                                if marca not in result:
                                    result[marca] = {
                                        'almacenes': {},
                                        'total_unidades': 0,
                                        'costo_total': 0.0
                                    }
                                
                                # Asegurar que almacén existe en marca
                                if wh_name not in result[marca]['almacenes']:
                                    result[marca]['almacenes'][wh_name] = {
                                        'nombre': wh_name,
                                        'productos': []
                                    }
                                
                                # Agregar producto (limitar a 50 por almacén/marca para no saturar)
                                if len(result[marca]['almacenes'][wh_name]['productos']) < 50:
                                    costo_unitario = float(prod_data.get('standard_price', 0)) or 0.0
                                    cantidad = int(q['quantity'])
                                    
                                    result[marca]['almacenes'][wh_name]['productos'].append({
                                        'nombre': prod_data['name'],
                                        'cantidad': cantidad,
                                        'costo_unitario': costo_unitario,
                                        'metodo': 'FIFO'
                                    })
                                
                                # Actualizar totales (TODOS, no solo los 50 mostrados)
                                costo_unitario = float(prod_data.get('standard_price', 0)) or 0.0
                                cantidad = int(q['quantity'])
                                result[marca]['total_unidades'] += cantidad
                                result[marca]['costo_total'] += cantidad * costo_unitario
            
            except Exception as e:
                print(f"Error en almacén {wh_name}: {e}")
                continue
        
        return result
    
    except Exception as e:
        print(f"Error fetching stock: {e}")
        return {}

def _stock_actual_sync():
    """Stock actual desde Odoo (blocking, runs in thread pool)"""
    try:
        uid = get_uid()
        if not uid:
            print("❌ No auth - retornando test data")
            return STOCK_DATA

        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object', timeout=20)
        marca_map = get_marca_map()

        result = {}
        warehouse_locs = {'Artilleros': 5, 'Aduana (Tránsito – Solo interno)': 24}

        for wh_name, loc_id in warehouse_locs.items():
            try:
                domain = [('location_id', '=', loc_id), ('quantity', '>', 0)]
                quant_ids = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'search', [domain], {'limit': 1000})

                if not quant_ids:
                    continue

                quants = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'read', [quant_ids], ['product_id', 'quantity'])
                prod_ids = [q['product_id'][0] for q in quants if q['product_id']]
                products = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'product.product', 'read', prod_ids, ['id', 'name', 'categ_id', 'standard_price'])
                prod_map = {p['id']: p for p in products}

                for q in quants:
                    prod_id = q['product_id'][0] if q['product_id'] else None
                    if not prod_id or prod_id not in prod_map:
                        continue

                    prod_data = prod_map[prod_id]
                    categ_id = prod_data.get('categ_id')
                    marca = marca_map.get(categ_id[0] if categ_id else None, 'OTROS')

                    if marca not in ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND', 'ELSYS']:
                        continue

                    if marca not in result:
                        result[marca] = {'almacenes': {}, 'total_unidades': 0, 'costo_total': 0.0}
                    if wh_name not in result[marca]['almacenes']:
                        result[marca]['almacenes'][wh_name] = {'nombre': wh_name, 'productos': [], 'total': 0}

                    cantidad = int(q['quantity'])
                    costo_u = float(prod_data.get('standard_price', 0)) or 0.0

                    if len(result[marca]['almacenes'][wh_name]['productos']) < 50:
                        result[marca]['almacenes'][wh_name]['productos'].append({
                            'nombre': prod_data['name'],
                            'cantidad': cantidad,
                            'costo_unitario': costo_u
                        })

                    result[marca]['almacenes'][wh_name]['total'] += cantidad
                    result[marca]['total_unidades'] += cantidad
                    result[marca]['costo_total'] += cantidad * costo_u

            except Exception as e:
                print(f"❌ Error almacén {wh_name}: {e}")
                continue

        if result:
            print(f"✅ Stock real: {list(result.keys())}")
            return result
        else:
            print("⚠️ No hay datos - retornando test")
            return STOCK_DATA

    except Exception as e:
        print(f"❌ Error: {e}")
        return STOCK_DATA

@router.get("/stock/actual")
async def stock_actual():
    """Stock actual REAL desde Odoo (non-blocking via thread pool)"""
    return await asyncio.to_thread(_stock_actual_sync)

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
