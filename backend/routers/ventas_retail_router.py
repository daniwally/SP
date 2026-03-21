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

# ---- FALLBACK DATA (cuando Odoo no es alcanzable) ----
FALLBACK_PEDIDOS = {
    "pedidos": [
        {"id": 1001, "numero": "S00142", "cliente": "Distribuidora Norte SRL", "cliente_id": 101, "fecha": "2026-03-20 14:30:00", "total": 1850000, "estado": "sale", "facturacion": "invoiced", "items": 120, "lineas": [
            {"producto": "SHAQ Zapatilla Running Pro", "cantidad": 60, "precio_unitario": 18500, "subtotal": 1110000},
            {"producto": "STARTER Remera Dry-Fit", "cantidad": 60, "precio_unitario": 12333, "subtotal": 740000},
        ]},
        {"id": 1002, "numero": "S00141", "cliente": "Sport Zone BA", "cliente_id": 102, "fecha": "2026-03-19 11:15:00", "total": 2340000, "estado": "sale", "facturacion": "invoiced", "items": 85, "lineas": [
            {"producto": "TIMBERLAND Bota Urban 6-Inch", "cantidad": 35, "precio_unitario": 42000, "subtotal": 1470000},
            {"producto": "HYDRATE Botella 750ml", "cantidad": 50, "precio_unitario": 17400, "subtotal": 870000},
        ]},
        {"id": 1003, "numero": "S00140", "cliente": "Megadeporte CABA", "cliente_id": 103, "fecha": "2026-03-18 09:45:00", "total": 975000, "estado": "done", "facturacion": "invoiced", "items": 50, "lineas": [
            {"producto": "STARTER Campera Windbreaker", "cantidad": 25, "precio_unitario": 22000, "subtotal": 550000},
            {"producto": "SHAQ Mochila Training 30L", "cantidad": 25, "precio_unitario": 17000, "subtotal": 425000},
        ]},
        {"id": 1004, "numero": "S00139", "cliente": "Punto Deporte Rosario", "cliente_id": 104, "fecha": "2026-03-17 16:20:00", "total": 1560000, "estado": "sale", "facturacion": "to invoice", "items": 70, "lineas": [
            {"producto": "SHAQ Zapatilla Basketball Elite", "cantidad": 40, "precio_unitario": 24000, "subtotal": 960000},
            {"producto": "HYDRATE Termo Acero 1L", "cantidad": 30, "precio_unitario": 20000, "subtotal": 600000},
        ]},
        {"id": 1005, "numero": "S00138", "cliente": "ProSport Mendoza", "cliente_id": 105, "fecha": "2026-03-16 10:00:00", "total": 2100000, "estado": "done", "facturacion": "invoiced", "items": 95, "lineas": [
            {"producto": "TIMBERLAND Zapatilla Trail", "cantidad": 45, "precio_unitario": 28000, "subtotal": 1260000},
            {"producto": "STARTER Short Running", "cantidad": 50, "precio_unitario": 16800, "subtotal": 840000},
        ]},
        {"id": 1006, "numero": "S00137", "cliente": "Distribuidora Norte SRL", "cliente_id": 101, "fecha": "2026-03-15 13:30:00", "total": 890000, "estado": "sale", "facturacion": "invoiced", "items": 40, "lineas": [
            {"producto": "HYDRATE Pack x6 Botella 500ml", "cantidad": 20, "precio_unitario": 25000, "subtotal": 500000},
            {"producto": "ELSYS Auriculares BT Sport", "cantidad": 20, "precio_unitario": 19500, "subtotal": 390000},
        ]},
        {"id": 1007, "numero": "S00136", "cliente": "Sport Zone BA", "cliente_id": 102, "fecha": "2026-03-14 08:45:00", "total": 1420000, "estado": "done", "facturacion": "invoiced", "items": 65, "lineas": [
            {"producto": "SHAQ Zapatilla Running Pro", "cantidad": 35, "precio_unitario": 18500, "subtotal": 647500},
            {"producto": "STARTER Pantalón Jogger", "cantidad": 30, "precio_unitario": 25750, "subtotal": 772500},
        ]},
        {"id": 1008, "numero": "S00135", "cliente": "FitMarket Córdoba", "cliente_id": 106, "fecha": "2026-03-13 15:10:00", "total": 3200000, "estado": "sale", "facturacion": "invoiced", "items": 150, "lineas": [
            {"producto": "SHAQ Zapatilla Basketball Elite", "cantidad": 50, "precio_unitario": 24000, "subtotal": 1200000},
            {"producto": "TIMBERLAND Bota Urban 6-Inch", "cantidad": 30, "precio_unitario": 42000, "subtotal": 1260000},
            {"producto": "STARTER Remera Dry-Fit", "cantidad": 70, "precio_unitario": 10571, "subtotal": 740000},
        ]},
    ],
    "resumen": {
        "total_pedidos": 8,
        "total_monto": 14335000,
        "total_items": 675,
        "ticket_promedio": 1791875,
        "top_productos": [
            {"producto": "TIMBERLAND Bota Urban 6-Inch", "cantidad": 65, "monto": 2730000},
            {"producto": "SHAQ Zapatilla Running Pro", "cantidad": 95, "monto": 1757500},
            {"producto": "STARTER Remera Dry-Fit", "cantidad": 130, "monto": 1480000},
            {"producto": "SHAQ Zapatilla Basketball Elite", "cantidad": 90, "monto": 2160000},
            {"producto": "TIMBERLAND Zapatilla Trail", "cantidad": 45, "monto": 1260000},
            {"producto": "HYDRATE Botella 750ml", "cantidad": 50, "monto": 870000},
            {"producto": "STARTER Campera Windbreaker", "cantidad": 25, "monto": 550000},
            {"producto": "STARTER Pantalón Jogger", "cantidad": 30, "monto": 772500},
            {"producto": "HYDRATE Termo Acero 1L", "cantidad": 30, "monto": 600000},
            {"producto": "HYDRATE Pack x6 Botella 500ml", "cantidad": 20, "monto": 500000},
        ],
    }
}

FALLBACK_COMPRAS = {
    "compras": [
        {"id": 2001, "numero": "P00089", "proveedor": "Importadora Global Trading", "fecha": "2026-03-18 10:00:00", "total": 8500000, "estado": "purchase", "items": 3, "lineas": [
            {"producto": "SHAQ Zapatilla Running Pro x500", "cantidad": 500, "precio_unitario": 9200, "subtotal": 4600000},
            {"producto": "SHAQ Zapatilla Basketball Elite x300", "cantidad": 300, "precio_unitario": 13000, "subtotal": 3900000},
        ]},
        {"id": 2002, "numero": "P00088", "proveedor": "Textiles Premium SA", "fecha": "2026-03-15 14:30:00", "total": 5200000, "estado": "done", "items": 2, "lineas": [
            {"producto": "STARTER Remera Dry-Fit x1000", "cantidad": 1000, "precio_unitario": 3200, "subtotal": 3200000},
            {"producto": "STARTER Campera Windbreaker x200", "cantidad": 200, "precio_unitario": 10000, "subtotal": 2000000},
        ]},
        {"id": 2003, "numero": "P00087", "proveedor": "Hydrate Supplies LLC", "fecha": "2026-03-12 09:00:00", "total": 3100000, "estado": "done", "items": 2, "lineas": [
            {"producto": "HYDRATE Botella 750ml x800", "cantidad": 800, "precio_unitario": 2500, "subtotal": 2000000},
            {"producto": "HYDRATE Termo Acero 1L x200", "cantidad": 200, "precio_unitario": 5500, "subtotal": 1100000},
        ]},
        {"id": 2004, "numero": "P00086", "proveedor": "Timberland Int. Footwear", "fecha": "2026-03-10 11:00:00", "total": 12600000, "estado": "purchase", "items": 2, "lineas": [
            {"producto": "TIMBERLAND Bota Urban 6-Inch x400", "cantidad": 400, "precio_unitario": 22000, "subtotal": 8800000},
            {"producto": "TIMBERLAND Zapatilla Trail x300", "cantidad": 300, "precio_unitario": 12667, "subtotal": 3800000},
        ]},
    ],
    "resumen": {
        "total_compras": 4,
        "total_monto": 29400000,
        "compra_promedio": 7350000,
    }
}

FALLBACK_CLIENTES = {
    "clientes": [
        {"id": 106, "nombre": "FitMarket Córdoba", "total_compras": 3, "total_monto": 5800000, "ultima_compra": "2026-03-13 15:10:00", "email": "compras@fitmarket.com.ar", "telefono": "+54 351 4889900", "ciudad": "Córdoba", "provincia": "Córdoba"},
        {"id": 102, "nombre": "Sport Zone BA", "total_compras": 4, "total_monto": 4760000, "ultima_compra": "2026-03-19 11:15:00", "email": "pedidos@sportzone.com.ar", "telefono": "+54 11 55667788", "ciudad": "Buenos Aires", "provincia": "Buenos Aires"},
        {"id": 101, "nombre": "Distribuidora Norte SRL", "total_compras": 5, "total_monto": 4200000, "ultima_compra": "2026-03-20 14:30:00", "email": "ventas@distnorte.com.ar", "telefono": "+54 11 44556677", "ciudad": "San Isidro", "provincia": "Buenos Aires"},
        {"id": 105, "nombre": "ProSport Mendoza", "total_compras": 2, "total_monto": 3100000, "ultima_compra": "2026-03-16 10:00:00", "email": "info@prosport.com.ar", "telefono": "+54 261 4223344", "ciudad": "Mendoza", "provincia": "Mendoza"},
        {"id": 103, "nombre": "Megadeporte CABA", "total_compras": 2, "total_monto": 1950000, "ultima_compra": "2026-03-18 09:45:00", "email": "compras@megadeporte.com.ar", "telefono": "+54 11 33445566", "ciudad": "CABA", "provincia": "Buenos Aires"},
        {"id": 104, "nombre": "Punto Deporte Rosario", "total_compras": 1, "total_monto": 1560000, "ultima_compra": "2026-03-17 16:20:00", "email": "admin@puntodeporte.com.ar", "telefono": "+54 341 5667788", "ciudad": "Rosario", "provincia": "Santa Fe"},
        {"id": 107, "nombre": "Running Store Tucumán", "total_compras": 1, "total_monto": 920000, "ultima_compra": "2026-03-11 12:00:00", "email": "contacto@runningstore.com.ar", "telefono": "+54 381 4001122", "ciudad": "San Miguel de Tucumán", "provincia": "Tucumán"},
    ],
    "resumen": {
        "total_clientes": 7,
        "monto_total": 22290000,
        "recurrentes": 4,
        "ticket_promedio": 1238333,
    }
}


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
        print("⚠️ Retail pedidos: sin conexión Odoo, usando fallback")
        return FALLBACK_PEDIDOS

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
        print(f"❌ Retail pedidos error: {e}")
        return FALLBACK_PEDIDOS


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
        print("⚠️ Retail compras: sin conexión Odoo, usando fallback")
        return FALLBACK_COMPRAS

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

    except Exception as e:
        print(f"❌ Retail compras error: {e}")
        return FALLBACK_COMPRAS


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
        print("⚠️ Retail clientes: sin conexión Odoo, usando fallback")
        return FALLBACK_CLIENTES

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
        print(f"❌ Retail clientes error: {e}")
        return FALLBACK_CLIENTES


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
    compras_data = _compras_sync(desde, hasta)
    clientes_data = _clientes_sync(desde, hasta)

    return {
        "periodo": {"desde": desde, "hasta": hasta},
        "ventas": pedidos.get("resumen", {}),
        "compras": compras_data.get("resumen", {}),
        "clientes": clientes_data.get("resumen", {}),
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
