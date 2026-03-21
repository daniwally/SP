from fastapi import APIRouter, Query
import xmlrpc.client
from datetime import datetime, timedelta
import os
import asyncio

router = APIRouter()

ODOO_URL = os.getenv("ODOO_URL", "https://gedvera-sobrepatas.odoo.com")
ODOO_DB = os.getenv("ODOO_DB", "gedvera-sobrepatas-main-25353401")
ODOO_USER = os.getenv("ODOO_USER", "rudolf@sobrepatas.com")
ODOO_KEY = os.getenv("ODOO_KEY", "")


def _get_uid():
    try:
        if not ODOO_KEY:
            return None
        common = xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/common', timeout=5)
        return common.authenticate(ODOO_DB, ODOO_USER, ODOO_KEY, {})
    except Exception as e:
        print(f"Auth error: {e}")
        return None


def _get_models():
    return xmlrpc.client.ServerProxy(f'{ODOO_URL}/xmlrpc/2/object', timeout=20)


# ---------------------------------------------------------------------------
# sale.order
# ---------------------------------------------------------------------------
def _pedidos_sync(desde: str, hasta: str):
    """Pedidos de venta en rango de fechas"""
    uid = _get_uid()
    if not uid:
        return {"error": "Sin conexión a Odoo", "pedidos": [], "resumen": {}}

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
            'fields': [
                'name', 'partner_id', 'date_order', 'amount_total',
                'state', 'invoice_status', 'order_line',
            ],
            'order': 'date_order desc',
            'limit': 500,
        }
    )

    # Get order lines for product detail
    all_line_ids = []
    for o in orders:
        all_line_ids.extend(o.get('order_line', []))

    lines_by_order = {}
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
                lines_by_order.setdefault(oid, []).append({
                    'producto': ln.get('name', ''),
                    'producto_id': ln['product_id'][0] if ln.get('product_id') else None,
                    'cantidad': ln.get('product_uom_qty', 0),
                    'precio_unitario': ln.get('price_unit', 0),
                    'subtotal': ln.get('price_subtotal', 0),
                })

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
            'lineas': lineas,
        })

    # Products ranking
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


@router.get("/pedidos")
async def pedidos(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    today = datetime.now()
    if not desde:
        desde = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    return await asyncio.to_thread(_pedidos_sync, desde, hasta)


# ---------------------------------------------------------------------------
# purchase.order
# ---------------------------------------------------------------------------
def _compras_sync(desde: str, hasta: str):
    uid = _get_uid()
    if not uid:
        return {"error": "Sin conexión a Odoo", "compras": [], "resumen": {}}

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
                lines_by_order.setdefault(oid, []).append({
                    'producto': ln.get('name', ''),
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


@router.get("/compras")
async def compras(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    today = datetime.now()
    if not desde:
        desde = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    return await asyncio.to_thread(_compras_sync, desde, hasta)


# ---------------------------------------------------------------------------
# res.partner  (clientes que compraron)
# ---------------------------------------------------------------------------
def _clientes_sync(desde: str, hasta: str):
    uid = _get_uid()
    if not uid:
        return {"error": "Sin conexión a Odoo", "clientes": [], "resumen": {}}

    models = _get_models()

    # Get sale orders in range to find customers
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

    # Aggregate by partner
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

    # Enrich with partner data (city, phone, email)
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

    # Round amounts
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


@router.get("/clientes")
async def clientes(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    today = datetime.now()
    if not desde:
        desde = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    return await asyncio.to_thread(_clientes_sync, desde, hasta)


# ---------------------------------------------------------------------------
# Dashboard resumen (combines all three)
# ---------------------------------------------------------------------------
def _dashboard_sync(desde: str, hasta: str):
    pedidos = _pedidos_sync(desde, hasta)
    compras = _compras_sync(desde, hasta)
    clientes = _clientes_sync(desde, hasta)

    return {
        "periodo": {"desde": desde, "hasta": hasta},
        "ventas": pedidos.get("resumen", {}),
        "compras": compras.get("resumen", {}),
        "clientes": clientes.get("resumen", {}),
    }


@router.get("/dashboard")
async def dashboard(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    today = datetime.now()
    if not desde:
        desde = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    return await asyncio.to_thread(_dashboard_sync, desde, hasta)
