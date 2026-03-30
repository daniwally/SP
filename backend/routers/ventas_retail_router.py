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

EMPTY_PEDIDOS = {"pedidos": [], "resumen": {"total_pedidos": 0, "total_monto": 0, "total_items": 0, "ticket_promedio": 0, "top_productos": []}}
EMPTY_COMPRAS = {"compras": [], "resumen": {"total_compras": 0, "total_monto": 0, "compra_promedio": 0}}
EMPTY_CLIENTES = {"clientes": [], "resumen": {"total_clientes": 0, "monto_total": 0, "recurrentes": 0, "ticket_promedio": 0}}
EMPTY_PRESUPUESTOS = {"presupuestos": {"total": 0, "monto": 0}}


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
def _pedidos_sync(desde: str, hasta: str, states=None):
    """Pedidos de venta en rango de fechas"""
    if states is None:
        states = ['sale', 'done']
    uid = _get_uid()
    if not uid:
        return {**EMPTY_PEDIDOS, "error": "Sin conexión a Odoo"}

    models = _get_models()

    try:
        domain = [
            ('date_order', '>=', f'{desde} 00:00:00'),
            ('date_order', '<=', f'{hasta} 23:59:59'),
            ('state', 'in', states),
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

        lines_raw = []
        all_product_ids = set()
        if all_line_ids:
            lines_raw = models.execute_kw(
                ODOO_DB, uid, ODOO_KEY, 'sale.order.line', 'read',
                [all_line_ids[:2000]],
                {
                    'fields': [
                        'order_id', 'product_id', 'product_uom_qty',
                        'price_unit', 'price_subtotal', 'name',
                    ],
                }
            )
            for ln in lines_raw:
                pid = ln['product_id'][0] if ln.get('product_id') else None
                if pid:
                    all_product_ids.add(pid)

        # Map product -> brand using categ_id (same mapping as valuation_router)
        categ_marca_map = {8: 'SHAQ', 7: 'STARTER', 11: 'HYDRATE', 6: 'TIMBERLAND', 10: 'ELSYS'}
        product_brand = {}
        if all_product_ids:
            pid_list = list(all_product_ids)[:2000]
            try:
                products = models.execute_kw(
                    ODOO_DB, uid, ODOO_KEY, 'product.product', 'read',
                    [pid_list],
                    {'fields': ['categ_id']},
                )
                for p in products:
                    categ = p.get('categ_id')
                    if categ:
                        categ_id = categ[0] if isinstance(categ, list) else categ
                        brand = categ_marca_map.get(categ_id)
                        if brand:
                            product_brand[p['id']] = brand
                        else:
                            # Try parent category name, skip generic ones
                            categ_name = categ[1] if isinstance(categ, list) else str(categ)
                            top = categ_name.split('/')[0].strip()
                            if top.lower() not in ('marcas', 'all', 'todos', ''):
                                product_brand[p['id']] = top
                print(f"[Retail] Brands mapped: {len(product_brand)} of {len(pid_list)} products")
            except Exception as e:
                print(f"[Retail] Brand mapping error: {e}")

        # Build lines_by_order with brand embedded
        lines_by_order = {}
        for ln in lines_raw:
            oid = ln['order_id'][0] if ln.get('order_id') else None
            if oid:
                pid = ln['product_id'][0] if ln.get('product_id') else None
                prod_name = ln['product_id'][1] if ln.get('product_id') else ln.get('name', '')
                marca = product_brand.get(pid, 'Sin marca') if pid else 'Sin marca'
                lines_by_order.setdefault(oid, []).append({
                    'producto': prod_name,
                    'producto_id': pid,
                    'marca': marca,
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

            # Get unique brands for this order
            order_brands = set()
            for ln in lineas:
                m = ln.get('marca')
                if m and m != 'Sin marca':
                    order_brands.add(m)

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

        marca_totals = {}
        for p in pedidos:
            for ln in p['lineas']:
                marca = ln.get('marca', 'Sin marca')
                if marca not in marca_totals:
                    marca_totals[marca] = {'marca': marca, 'monto': 0}
                marca_totals[marca]['monto'] += ln['subtotal']

        top_marcas = sorted(marca_totals.values(), key=lambda x: x['monto'], reverse=True)[:10]

        resumen = {
            'total_pedidos': len(pedidos),
            'total_monto': round(total_monto, 2),
            'total_items': int(total_items),
            'ticket_promedio': round(total_monto / len(pedidos), 2) if pedidos else 0,
            'top_marcas': top_marcas,
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


@router.get("/presupuestos-detalle")
async def presupuestos_detalle(
    desde: str = Query(None),
    hasta: str = Query(None),
):
    today = datetime.now()
    if not desde:
        desde = today.replace(day=1).strftime('%Y-%m-%d')
    if not hasta:
        hasta = today.strftime('%Y-%m-%d')

    return await asyncio.to_thread(_pedidos_sync, desde, hasta, ['draft', 'sent'])


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
# Presupuestos (sale.order draft / sent)
# ---------------------------------------------------------------------------
def _presupuestos_sync(desde: str, hasta: str):
    uid = _get_uid()
    if not uid:
        return {**EMPTY_PRESUPUESTOS, "error": "Sin conexión a Odoo"}

    try:
        models = _get_models()

        domain = [
            ('date_order', '>=', f'{desde} 00:00:00'),
            ('date_order', '<=', f'{hasta} 23:59:59'),
            ('state', 'in', ['draft', 'sent']),
        ]

        orders = models.execute_kw(
            ODOO_DB, uid, ODOO_KEY, 'sale.order', 'search_read',
            [domain],
            {
                'fields': ['name', 'partner_id', 'date_order', 'amount_total', 'amount_untaxed', 'order_line'],
                'order': 'amount_total desc',
                'limit': 500,
            }
        )

        # Para presupuestos con amount_total=0, intentar calcular desde líneas
        zero_order_ids = [o['id'] for o in orders if not o.get('amount_total') and o.get('order_line')]
        lines_totals = {}
        if zero_order_ids:
            all_line_ids = []
            for o in orders:
                if o['id'] in zero_order_ids:
                    all_line_ids.extend(o.get('order_line', []))
            if all_line_ids:
                lines_raw = models.execute_kw(
                    ODOO_DB, uid, ODOO_KEY, 'sale.order.line', 'read',
                    [all_line_ids[:2000]],
                    {'fields': ['order_id', 'price_subtotal', 'price_total']}
                )
                for ln in lines_raw:
                    oid = ln['order_id'][0] if ln.get('order_id') else None
                    if oid:
                        lines_totals[oid] = lines_totals.get(oid, 0) + (ln.get('price_total') or ln.get('price_subtotal') or 0)

        total = len(orders)
        monto = 0
        top_ordenes = []
        for o in orders:
            amt = o.get('amount_total') or o.get('amount_untaxed') or lines_totals.get(o['id'], 0)
            monto += amt
            if len(top_ordenes) < 10:
                top_ordenes.append({
                    'numero': o.get('name', ''),
                    'cliente': o['partner_id'][1] if o.get('partner_id') else 'Sin cliente',
                    'fecha': o.get('date_order', ''),
                    'total': amt,
                })

        return {"presupuestos": {"total": total, "monto": round(monto, 2), "top_ordenes": top_ordenes}}

    except Exception as e:
        print(f"Retail presupuestos error: {e}")
        return {**EMPTY_PRESUPUESTOS, "error": str(e)}


# ---------------------------------------------------------------------------
# Dashboard resumen (combines all three)
# ---------------------------------------------------------------------------
def _resumen_periodo(pedidos_list, desde_str, hasta_str):
    """Filter orders by date range and return summary with top 5 orders."""
    filtrados = []
    for p in pedidos_list:
        fecha = (p.get('fecha') or '')[:10]
        if desde_str <= fecha <= hasta_str:
            filtrados.append(p)

    filtrados.sort(key=lambda x: x.get('total', 0), reverse=True)
    total = sum(p.get('total', 0) for p in filtrados)
    top5 = [{
        'numero': p.get('numero', ''),
        'cliente': p.get('cliente', ''),
        'fecha': p.get('fecha', ''),
        'total': p.get('total', 0),
        'items': p.get('items', 0),
    } for p in filtrados[:10]]

    return {
        'total_monto': round(total, 2),
        'total_pedidos': len(filtrados),
        'top_ordenes': top5,
    }


def _dashboard_sync(desde: str, hasta: str):
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    semana_desde = monday.strftime('%Y-%m-%d')
    mes_desde = today.replace(day=1).strftime('%Y-%m-%d')
    hoy = today.strftime('%Y-%m-%d')

    # Always fetch from 1st of month (or earlier if week starts before)
    fetch_desde = min(desde, mes_desde, semana_desde)

    pedidos = _pedidos_sync(fetch_desde, hasta)
    compras_data = _compras_sync(desde, hasta)
    clientes_data = _clientes_sync(desde, hasta)
    presupuestos_data = _presupuestos_sync(desde, hasta)

    all_pedidos = pedidos.get("pedidos", [])

    # Filter pedidos for user-selected range for the KPI resumen
    pedidos_rango = [p for p in all_pedidos if desde <= (p.get('fecha') or '')[:10] <= hasta]
    total_monto_rango = sum(p.get('total', 0) for p in pedidos_rango)
    total_items_rango = sum(p.get('items', 0) for p in pedidos_rango)
    resumen_rango = {
        'total_pedidos': len(pedidos_rango),
        'total_monto': round(total_monto_rango, 2),
        'total_items': int(total_items_rango),
        'ticket_promedio': round(total_monto_rango / len(pedidos_rango), 2) if pedidos_rango else 0,
    }

    result = {
        "periodo": {"desde": desde, "hasta": hasta},
        "ventas": resumen_rango,
        "top_marcas": pedidos.get("resumen", {}).get("top_marcas", []),
        "compras": compras_data.get("resumen", {}),
        "clientes": clientes_data.get("resumen", {}),
        "presupuestos": presupuestos_data.get("presupuestos", {}),
        "ventas_semana": {
            **_resumen_periodo(all_pedidos, semana_desde, hoy),
            "desde": semana_desde,
            "hasta": hoy,
        },
        "ventas_mes": {
            **_resumen_periodo(all_pedidos, mes_desde, hoy),
            "desde": mes_desde,
            "hasta": hoy,
        },
    }

    # Propagate error if any endpoint failed
    errors = [d.get("error") for d in [pedidos, compras_data, clientes_data, presupuestos_data] if d.get("error")]
    if errors:
        result["error"] = errors[0]

    return result


@router.get("/debug-presupuestos")
async def debug_presupuestos():
    """Debug: ver datos crudos de presupuestos en Odoo"""
    uid = _get_uid()
    if not uid:
        return {"error": "Sin conexión"}
    models = _get_models()
    today = datetime.now()
    desde = today.replace(day=1).strftime('%Y-%m-%d')
    hasta = today.strftime('%Y-%m-%d')

    orders = models.execute_kw(
        ODOO_DB, uid, ODOO_KEY, 'sale.order', 'search_read',
        [[
            ('date_order', '>=', f'{desde} 00:00:00'),
            ('date_order', '<=', f'{hasta} 23:59:59'),
            ('state', 'in', ['draft', 'sent']),
        ]],
        {'fields': ['name', 'partner_id', 'date_order', 'amount_total', 'amount_untaxed', 'amount_tax', 'state', 'order_line'], 'limit': 5}
    )
    # Para cada orden, traer líneas
    result = []
    for o in orders:
        lines = []
        if o.get('order_line'):
            lines_raw = models.execute_kw(
                ODOO_DB, uid, ODOO_KEY, 'sale.order.line', 'read',
                [o['order_line'][:5]],
                {'fields': ['name', 'product_uom_qty', 'price_unit', 'price_subtotal', 'price_total']}
            )
            lines = lines_raw
        result.append({
            "raw_order": {k: v for k, v in o.items() if k != 'order_line'},
            "order_line_count": len(o.get('order_line', [])),
            "lines_sample": lines,
        })
    return {"orders": result}


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
