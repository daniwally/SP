from fastapi import APIRouter, Query
import xmlrpc.client
from datetime import datetime, timedelta
import os
import asyncio

router = APIRouter()

ODOO_URL = os.getenv("ODOO_URL", "https://gedvera-sobrepatas.odoo.com")
ODOO_DB = os.getenv("ODOO_DB", "gedvera-sobrepatas-main-25353401")
ODOO_USER = os.getenv("ODOO_USER", "rudolf@sobrepatas.com")
ODOO_KEY = os.getenv("ODOO_KEY", "0115ec6a78f7a7329a152fe95f41b8152a22f4b9")

EMPTY_PEDIDOS = {"pedidos": [], "resumen": {"total_pedidos": 0, "total_monto": 0, "total_items": 0, "ticket_promedio": 0, "top_productos": []}}
EMPTY_COMPRAS = {"compras": [], "resumen": {"total_compras": 0, "total_monto": 0, "compra_promedio": 0}}
EMPTY_CLIENTES = {"clientes": [], "resumen": {"total_clientes": 0, "monto_total": 0, "recurrentes": 0, "ticket_promedio": 0}}


def _get_uid():
    try:
        if not ODOO_KEY:
            return None
        common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common')
        return common.authenticate(ODOO_DB, ODOO_USER, ODOO_KEY, {})
    except Exception as e:
        print(f"Retail auth error: {e}")
        return None


def _get_models():
    return xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object')


# ---------------------------------------------------------------------------
# sale.order
# ---------------------------------------------------------------------------
def _pedidos_sync(desde: str, hasta: str):
    """Pedidos de venta en rango de fechas"""
    uid = _get_uid()
    if not uid:
        return {**EMPTY_PEDIDOS, "error": "Sin conexión a Odoo"}

    models = _get_models()

    try:
        domain = [
            ('date_order', '>=', f'{desde} 00:00:00'),
            ('date_order', '<=', f'{hasta} 23:59:59'),
            ('state', 'in', ['sale', 'done']),
        ]

        orders = models.execute_kw(
            ODOO_DB, uid, ODOO_KEY, 'sale.order', 'search_read',
            [domain],
            {
                'fields': [
                    'name', 'partner_id', 'date_order', 'amount_total',
                    'state', 'invoice_status', 'order_line',
                ],
                'order': 'date_order desc',
                'limit': 500,
            }
        )

        all_line_ids = []
        for o in orders:
            all_line_ids.extend(o.get('order_line', []))

        lines_by_order = {}
        all_product_ids = set()
        if all_line_ids:
            lines = models.execute_kw(
                ODOO_DB, uid, ODOO_KEY, 'sale.order.line', 'read',
                [all_line_ids[:2000]],
                {
                    'fields': [
                        'order_id', 'product_id', 'product_uom_qty',
                        'price_unit', 'price_subtotal', 'name',
                    ],
                }
            )
            for ln in lines:
                oid = ln['order_id'][0] if ln.get('order_id') else None
                if oid:
                    pid = ln['product_id'][0] if ln.get('product_id') else None
                    prod_name = ln['product_id'][1] if ln.get('product_id') else ln.get('name', '')
                    if pid:
                        all_product_ids.add(pid)
                    lines_by_order.setdefault(oid, []).append({
                        'producto': prod_name,
                        'producto_id': pid,
                        'cantidad': ln.get('product_uom_qty', 0),
                        'precio_unitario': ln.get('price_unit', 0),
                        'subtotal': ln.get('price_subtotal', 0),
                    })

        # Fetch brand for each product from product.product
        product_brand = {}
        if all_product_ids:
            try:
                products = models.execute_kw(
                    ODOO_DB, uid, ODOO_KEY, 'product.product', 'read',
                    [list(all_product_ids)[:2000]],
                    {'fields': ['product_brand_id']},
                )
                for p in products:
                    brand = p.get('product_brand_id')
                    if brand:
                        product_brand[p['id']] = brand[1] if isinstance(brand, list) else str(brand)
            except Exception as e:
                print(f"Brand fetch error: {e}")

        pedidos = []
        total_monto = 0
        total_items = 0

        for o in orders:
            oid = o['id']
            lineas = lines_by_order.get(oid, [])
            qty = sum(l['cantidad'] for l in lineas)
            monto = o.get('amount_total', 0)
            total_monto += monto
            total_items += qty

            # Get unique brands for this order
            order_brands = set()
            for ln in lineas:
                pid = ln.get('producto_id')
                if pid and pid in product_brand:
                    order_brands.add(product_brand[pid])

            pedidos.append({
                'id': oid,
                'numero': o.get('name', ''),
                'cliente': o['partner_id'][1] if o.get('partner_id') else 'Sin cliente',
                'cliente_id': o['partner_id'][0] if o.get('partner_id') else None,
                'fecha': o.get('date_order', ''),
                'total': monto,
                'estado': o.get('state', ''),
                'facturacion': o.get('invoice_status', ''),
                'items': int(qty),
                'marcas': sorted(order_brands),
                'lineas': lineas,
            })

        prod_totals = {}
        for p in pedidos:
            for ln in p['lineas']:
                key = ln['producto']
                if key not in prod_totals:
                    prod_totals[key] = {'producto': key, 'cantidad': 0, 'monto': 0}
                prod_totals[key]['cantidad'] += ln['cantidad']
                prod_totals[key]['monto'] += ln['subtotal']

        top_productos = sorted(prod_totals.values(), key=lambda x: x['monto'], reverse=True)[:10]

        resumen = {
            'total_pedidos': len(pedidos),
            'total_monto': round(total_monto, 2),
            'total_items': int(total_items),
            'ticket_promedio': round(total_monto / len(pedidos), 2) if pedidos else 0,
            'top_productos': top_productos,
        }

        return {"pedidos": pedidos, "resumen": resumen}

    except Exception as e:
        print(f"Retail pedidos error: {e}")
        return {**EMPTY_PEDIDOS, "error": str(e)}


@router.get("/pedidos")
async def pedidos(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    today = datetime.now()
    if not desde:
        desde = today.replace(day=1).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    return await asyncio.to_thread(_pedidos_sync, desde, hasta)


# ---------------------------------------------------------------------------
# purchase.order
# ---------------------------------------------------------------------------
def _compras_sync(desde: str, hasta: str):
    uid = _get_uid()
    if not uid:
        return {**EMPTY_COMPRAS, "error": "Sin conexión a Odoo"}

    try:
        models = _get_models()

        domain = [
            ('date_order', '>=', f'{desde} 00:00:00'),
            ('date_order', '<=', f'{hasta} 23:59:59'),
            ('state', 'in', ['purchase', 'done']),
        ]

        orders = models.execute_kw(
            ODOO_DB, uid, ODOO_KEY, 'purchase.order', 'search_read',
            [domain],
            {
                'fields': [
                    'name', 'partner_id', 'date_order', 'amount_total',
                    'state', 'order_line',
                ],
                'order': 'date_order desc',
                'limit': 500,
            }
        )

        all_line_ids = []
        for o in orders:
            all_line_ids.extend(o.get('order_line', []))

        lines_by_order = {}
        if all_line_ids:
            lines = models.execute_kw(
                ODOO_DB, uid, ODOO_KEY, 'purchase.order.line', 'read',
                [all_line_ids[:2000]],
                {
                    'fields': [
                        'order_id', 'product_id', 'product_qty',
                        'price_unit', 'price_subtotal', 'name',
                    ],
                }
            )
            for ln in lines:
                oid = ln['order_id'][0] if ln.get('order_id') else None
                if oid:
                    prod_name = ln['product_id'][1] if ln.get('product_id') else ln.get('name', '')
                    lines_by_order.setdefault(oid, []).append({
                        'producto': prod_name,
                        'cantidad': ln.get('product_qty', 0),
                        'precio_unitario': ln.get('price_unit', 0),
                        'subtotal': ln.get('price_subtotal', 0),
                    })

        compras = []
        total_monto = 0

        for o in orders:
            oid = o['id']
            lineas = lines_by_order.get(oid, [])
            monto = o.get('amount_total', 0)
            total_monto += monto

            compras.append({
                'id': oid,
                'numero': o.get('name', ''),
                'proveedor': o['partner_id'][1] if o.get('partner_id') else 'Sin proveedor',
                'fecha': o.get('date_order', ''),
                'total': monto,
                'estado': o.get('state', ''),
                'items': len(lineas),
                'lineas': lineas,
            })

        resumen = {
            'total_compras': len(compras),
            'total_monto': round(total_monto, 2),
            'compra_promedio': round(total_monto / len(compras), 2) if compras else 0,
        }

        return {"compras": compras, "resumen": resumen}

    except Exception as e:
        print(f"Retail compras error: {e}")
        return {**EMPTY_COMPRAS, "error": str(e)}


@router.get("/compras")
async def compras(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    today = datetime.now()
    if not desde:
        desde = today.replace(day=1).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    return await asyncio.to_thread(_compras_sync, desde, hasta)


# ---------------------------------------------------------------------------
# res.partner  (clientes que compraron)
# ---------------------------------------------------------------------------
def _clientes_sync(desde: str, hasta: str):
    uid = _get_uid()
    if not uid:
        return {**EMPTY_CLIENTES, "error": "Sin conexión a Odoo"}

    try:
        models = _get_models()

        domain = [
            ('date_order', '>=', f'{desde} 00:00:00'),
            ('date_order', '<=', f'{hasta} 23:59:59'),
            ('state', 'in', ['sale', 'done']),
        ]

        orders = models.execute_kw(
            ODOO_DB, uid, ODOO_KEY, 'sale.order', 'search_read',
            [domain],
            {
                'fields': ['partner_id', 'amount_total', 'date_order'],
                'limit': 1000,
            }
        )

        partner_stats = {}
        for o in orders:
            pid = o['partner_id'][0] if o.get('partner_id') else None
            pname = o['partner_id'][1] if o.get('partner_id') else 'Sin cliente'
            if not pid:
                continue
            if pid not in partner_stats:
                partner_stats[pid] = {
                    'id': pid,
                    'nombre': pname,
                    'total_compras': 0,
                    'total_monto': 0,
                    'ultima_compra': '',
                }
            partner_stats[pid]['total_compras'] += 1
            partner_stats[pid]['total_monto'] += o.get('amount_total', 0)
            fecha = o.get('date_order', '')
            if fecha > partner_stats[pid]['ultima_compra']:
                partner_stats[pid]['ultima_compra'] = fecha

        partner_ids = list(partner_stats.keys())
        if partner_ids:
            partners = models.execute_kw(
                ODOO_DB, uid, ODOO_KEY, 'res.partner', 'read',
                [partner_ids[:500]],
                {
                    'fields': ['name', 'email', 'phone', 'city', 'state_id', 'country_id'],
                }
            )
            for p in partners:
                pid = p['id']
                if pid in partner_stats:
                    partner_stats[pid]['email'] = p.get('email') or ''
                    partner_stats[pid]['telefono'] = p.get('phone') or ''
                    partner_stats[pid]['ciudad'] = p.get('city') or ''
                    partner_stats[pid]['provincia'] = p['state_id'][1] if p.get('state_id') else ''

        clientes = sorted(partner_stats.values(), key=lambda x: x['total_monto'], reverse=True)

        for c in clientes:
            c['total_monto'] = round(c['total_monto'], 2)

        resumen = {
            'total_clientes': len(clientes),
            'monto_total': round(sum(c['total_monto'] for c in clientes), 2),
            'recurrentes': sum(1 for c in clientes if c['total_compras'] > 1),
            'ticket_promedio': round(
                sum(c['total_monto'] for c in clientes) / sum(c['total_compras'] for c in clientes), 2
            ) if clientes else 0,
        }

        return {"clientes": clientes, "resumen": resumen}

    except Exception as e:
        print(f"Retail clientes error: {e}")
        return {**EMPTY_CLIENTES, "error": str(e)}


@router.get("/clientes")
async def clientes(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    today = datetime.now()
    if not desde:
        desde = today.replace(day=1).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    return await asyncio.to_thread(_clientes_sync, desde, hasta)


# ---------------------------------------------------------------------------
# Dashboard resumen (combines all three)
# ---------------------------------------------------------------------------
def _dashboard_sync(desde: str, hasta: str):
    pedidos = _pedidos_sync(desde, hasta)
    compras_data = _compras_sync(desde, hasta)
    clientes_data = _clientes_sync(desde, hasta)

    result = {
        "periodo": {"desde": desde, "hasta": hasta},
        "ventas": pedidos.get("resumen", {}),
        "compras": compras_data.get("resumen", {}),
        "clientes": clientes_data.get("resumen", {}),
    }

    # Propagate error if any endpoint failed
    errors = [d.get("error") for d in [pedidos, compras_data, clientes_data] if d.get("error")]
    if errors:
        result["error"] = errors[0]

    return result


@router.get("/dashboard")
async def dashboard(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    today = datetime.now()
    if not desde:
        desde = today.replace(day=1).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    return await asyncio.to_thread(_dashboard_sync, desde, hasta)
