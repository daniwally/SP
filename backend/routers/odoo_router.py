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

# Mapeo fijo de categoría -> marca (mismo que valuation_router y ventas_retail_router)
CATEG_MARCA_MAP = {8: 'SHAQ', 7: 'STARTER', 11: 'HYDRATE', 6: 'TIMBERLAND', 10: 'ELSYS'}


def _stock_actual_sync():
    """Stock actual desde Odoo (blocking, runs in thread pool).
    Usa search_read en vez de search+read para minimizar llamadas XML-RPC.
    """
    try:
        common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_KEY, {})
        if not uid:
            return {"error": "Sin conexión a Odoo"}

        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')

        loc_name_map = {5: 'Artilleros', 24: 'Aduana (Tránsito – Solo interno)'}

        # 1) Traer todos los quants de las 2 ubicaciones en UNA sola llamada
        quants = models.execute_kw(
            ODOO_DB, uid, ODOO_KEY, 'stock.quant', 'search_read',
            [[('location_id', 'in', [5, 24]), ('quantity', '>', 0)]],
            {'fields': ['product_id', 'location_id', 'quantity'], 'limit': 5000}
        )

        if not quants:
            return {"error": "No se obtuvieron datos de stock desde Odoo"}

        # 2) Traer productos con atributos de variante en UNA sola llamada
        all_prod_ids = list(set(q['product_id'][0] for q in quants if q.get('product_id')))
        all_prods = models.execute_kw(
            ODOO_DB, uid, ODOO_KEY, 'product.product', 'search_read',
            [[('id', 'in', all_prod_ids)]],
            {'fields': ['id', 'name', 'categ_id', 'default_code', 'product_template_attribute_value_ids', 'product_tmpl_id', 'image_128'], 'limit': 5000}
        )

        # 2b) Traer valores de atributos de variante (color, talle, etc.)
        all_attr_val_ids = set()
        for p in all_prods:
            all_attr_val_ids.update(p.get('product_template_attribute_value_ids') or [])

        attr_map = {}
        if all_attr_val_ids:
            attr_vals = models.execute_kw(
                ODOO_DB, uid, ODOO_KEY, 'product.template.attribute.value', 'search_read',
                [[('id', 'in', list(all_attr_val_ids))]],
                {'fields': ['id', 'attribute_id', 'name'], 'limit': 5000}
            )
            for av in attr_vals:
                attr_name = av['attribute_id'][1] if av.get('attribute_id') else ''
                attr_map[av['id']] = {'atributo': attr_name, 'valor': av['name']}

        prod_map = {}
        for p in all_prods:
            attrs = {}
            for av_id in (p.get('product_template_attribute_value_ids') or []):
                if av_id in attr_map:
                    a = attr_map[av_id]
                    attrs[a['atributo']] = a['valor']
            p['_attrs'] = attrs
            prod_map[p['id']] = p

        # 3) Agrupar por marca y almacén
        result = {}
        for q in quants:
            prod_id = q['product_id'][0] if q.get('product_id') else None
            if not prod_id or prod_id not in prod_map:
                continue

            loc_id = q['location_id'][0] if isinstance(q['location_id'], (list, tuple)) else q['location_id']
            wh_name = loc_name_map.get(loc_id)
            if not wh_name:
                continue

            prod_data = prod_map[prod_id]
            categ_id = prod_data.get('categ_id')
            marca = CATEG_MARCA_MAP.get(categ_id[0] if categ_id else None, 'OTROS')

            if marca == 'OTROS':
                continue

            if marca not in result:
                result[marca] = {'almacenes': {}, 'total_unidades': 0}
            if wh_name not in result[marca]['almacenes']:
                result[marca]['almacenes'][wh_name] = {'nombre': wh_name, 'productos': [], 'total': 0}

            cantidad = int(q['quantity'])

            attrs = prod_data.get('_attrs', {})
            tmpl = prod_data.get('product_tmpl_id')
            prod_entry = {
                'nombre': prod_data['name'],
                'cantidad': cantidad,
                'sku': prod_data.get('default_code') or '',
                'template_id': tmpl[0] if tmpl else 0,
                'template_name': tmpl[1] if tmpl else prod_data['name'],
            }
            img = prod_data.get('image_128')
            if img:
                prod_entry['imagen'] = img
            if attrs:
                prod_entry['atributos'] = attrs
            result[marca]['almacenes'][wh_name]['productos'].append(prod_entry)

            result[marca]['almacenes'][wh_name]['total'] += cantidad
            result[marca]['total_unidades'] += cantidad

        if result:
            return result
        else:
            return {"error": "No se obtuvieron datos de stock desde Odoo"}

    except Exception as e:
        print(f"Stock error: {e}")
        return {"error": str(e)}

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
            return {"error": "Sin conexión a Odoo"}
        
        models = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')
        warehouse_ids = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.warehouse', 'search', [])
        warehouses = models.execute_kw(ODOO_DB, uid, ODOO_KEY, 'stock.warehouse', 'read', 
                                       [warehouse_ids], ['id', 'name'])
        
        return {str(w['id']): w['name'] for w in warehouses}
    
    except Exception as e:
        print(f"Error fetching almacenes: {e}")
        return {"error": str(e)}

@router.get("/stock/consolidado")
async def stock_consolidado():
    """Stock consolidado por marca (datos en vivo de Odoo)"""
    stock = await asyncio.to_thread(_stock_actual_sync)
    if "error" in stock:
        return stock
    consolidado = {}
    for marca, data in stock.items():
        total_u = data.get("total_unidades", 0)
        consolidado[marca] = {
            "total_unidades": total_u,
        }
    return consolidado

@router.get("/facturas/mes")
async def facturas_mes():
    """Facturas del mes actual"""
    try:
        uid = get_uid()
        if not uid:
            return {"error": "Sin conexión a Odoo"}
        
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
