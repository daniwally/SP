from fastapi import APIRouter
import xmlrpc.client
from collections import defaultdict

router = APIRouter(prefix="/api/odoo", tags=["odoo"])

ODOO_URL = 'https://gedvera-sobrepatas.odoo.com'
ODOO_DB = 'gedvera-sobrepatas-main-25353401'
ODOO_USER = 'rudolf@sobrepatas.com'
ODOO_KEY = '0115ec6a78f7a7329a152fe95f41b8152a22f4b9'

# Precios temporales
PRECIO_TEMPORAL = {
    'SHAQ': 52000,
    'STARTER': 39000,
    # HYDRATE usa pricelist real
}

@router.get("/valuacion")
async def get_valuacion():
    """
    Valuación de stock cruzado (Artilleros + Zona Franca)
    con precios reales de pricelist y temporales donde aplique.
    """
    try:
        common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_KEY, {})
        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        
        # Precios de pricelist
        all_items = []
        offset = 0
        while True:
            items = models.execute_kw(
                ODOO_DB, uid, ODOO_KEY, 'product.pricelist.item', 'search_read',
                [], {'fields': ['product_id', 'product_tmpl_id', 'fixed_price'],
                     'limit': 500, 'offset': offset}
            )
            if not items:
                break
            all_items.extend(items)
            offset += 500
        
        precio_by_product_id = {}
        precio_by_tmpl_id = {}
        
        for item in all_items:
            if item.get('fixed_price', 0) > 0:
                if item.get('product_id'):
                    precio_by_product_id[item['product_id'][0]] = item['fixed_price']
                if item.get('product_tmpl_id'):
                    tmpl_id = item['product_tmpl_id'][0]
                    if tmpl_id not in precio_by_tmpl_id:
                        precio_by_tmpl_id[tmpl_id] = item['fixed_price']
        
        # Stock
        quants = models.execute_kw(
            ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'search_read',
            [], {'fields': ['product_id', 'location_id', 'quantity'], 'limit': 5000}
        )
        
        stock_by_loc = defaultdict(lambda: defaultdict(float))
        all_prod_ids = set()
        for q in quants:
            if q.get('product_id') and q.get('location_id'):
                prod_id = q['product_id'][0]
                loc_id = q['location_id'][0] if isinstance(q['location_id'], (list, tuple)) else q['location_id']
                qty = float(q.get('quantity', 0))
                
                stock_by_loc[loc_id][prod_id] += qty
                all_prod_ids.add(prod_id)
        
        # Productos
        all_prods = models.execute_kw(
            ODOO_DB, uid, ODOO_KEY, 'product.product', 'search_read',
            [], {'fields': ['id', 'default_code', 'name', 'categ_id', 'product_tmpl_id'],
                 'limit': 5000}
        )
        
        prod_map = {p['id']: p for p in all_prods}
        
        categ_marca_map = {8: 'SHAQ', 7: 'STARTER', 11: 'HYDRATE', 6: 'TIMBERLAND', 10: 'ELSYS', 9: 'HOUSE OF MATS'}
        
        def get_precio(prod_id, marca):
            if marca in PRECIO_TEMPORAL:
                return PRECIO_TEMPORAL[marca]
            
            if prod_id in precio_by_product_id:
                return precio_by_product_id[prod_id]
            
            if prod_id in prod_map:
                tmpl_id = prod_map[prod_id].get('product_tmpl_id')
                if tmpl_id:
                    tmpl_id = tmpl_id[0] if isinstance(tmpl_id, (list, tuple)) else tmpl_id
                    if tmpl_id in precio_by_tmpl_id:
                        return precio_by_tmpl_id[tmpl_id]
            
            return 0
        
        # Agrupación
        valuacion_by_marca = defaultdict(lambda: defaultdict(lambda: {'qty': 0, 'valor': 0}))
        
        for loc_id in [5, 24]:
            if loc_id not in stock_by_loc:
                continue
            
            for prod_id, qty in stock_by_loc[loc_id].items():
                if prod_id not in prod_map:
                    continue
                
                prod = prod_map[prod_id]
                categ_id = prod['categ_id'][0] if prod.get('categ_id') else None
                marca = categ_marca_map.get(categ_id, 'OTROS')
                
                precio = get_precio(prod_id, marca)
                valor = qty * precio
                
                valuacion_by_marca[marca][loc_id]['qty'] += qty
                valuacion_by_marca[marca][loc_id]['valor'] += valor
        
        # Formatear respuesta
        resultado = {}
        gran_total = 0
        
        for marca in sorted(valuacion_by_marca.keys()):
            marca_data = {'almacenes': {}, 'total_unidades': 0, 'total_valor': 0}
            
            for loc_id in sorted(valuacion_by_marca[marca].keys()):
                data = valuacion_by_marca[marca][loc_id]
                qty = data['qty']
                valor = data['valor']
                
                loc_name = {5: 'ARTILLEROS', 24: 'ZONA FRANCA'}.get(loc_id, f'LOC_{loc_id}')
                marca_data['almacenes'][loc_name] = {
                    'unidades': int(qty),
                    'valor': int(valor),
                    'precio_promedio': int(valor / qty) if qty > 0 else 0
                }
                
                marca_data['total_unidades'] += qty
                marca_data['total_valor'] += valor
                gran_total += valor
            
            resultado[marca] = marca_data
        
        resultado['TOTAL_GENERAL'] = int(gran_total)
        
        return resultado
        
    except Exception as e:
        return {'error': str(e)}
