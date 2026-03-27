import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './VentasRetailTab.css'

const LOGO_BASE = 'https://raw.githubusercontent.com/daniwally/SP/main/logos'
const BRAND_LOGOS = {
  'SHAQ': `${LOGO_BASE}/shaq-logo.png`,
  'STARTER': `${LOGO_BASE}/starter.png`,
  'HYDRATE': `${LOGO_BASE}/hydrate-logo.png`,
  'TIMBERLAND': `${LOGO_BASE}/TBL-logo.png`,
  'ELSYS': `${LOGO_BASE}/elsys.png`,
}

const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtDate = (d) => {
  if (!d) return '-'
  const parts = String(d).slice(0, 10).split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`
}

export default function VentasRetailTab({ refreshKey = 0 }) {
  const [subTab, setSubTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Date range: 1ro del mes actual hasta hoy por defecto
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)

  const [dashboard, setDashboard] = useState(null)
  const [pedidos, setPedidos] = useState(null)
  const [preVentas, setPreVentas] = useState(null)
  const [clientes, setClientes] = useState(null)
  const [expandedRows, setExpandedRows] = useState({})
  const [pedidosOpen, setPedidosOpen] = useState(false)
  const [preVentasOpen, setPreVentasOpen] = useState(false)

  const API = window.location.origin + '/api/retail'

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = `?desde=${desde}&hasta=${hasta}`

      if (subTab === 'dashboard') {
        const res = await axios.get(API + '/dashboard' + params, { timeout: 30000 })
        if (res.data.error) setError(res.data.error)
        setDashboard(res.data)
      } else if (subTab === 'pedidos') {
        const [res, resPV] = await Promise.all([
          axios.get(API + '/pedidos' + params, { timeout: 30000 }),
          axios.get(API + '/presupuestos-detalle' + params, { timeout: 30000 }),
        ])
        if (res.data.error) setError(res.data.error)
        setPedidos(res.data)
        setPreVentas(resPV.data)
      } else if (subTab === 'clientes') {
        const res = await axios.get(API + '/clientes' + params, { timeout: 30000 })
        if (res.data.error) setError(res.data.error)
        setClientes(res.data)
      }
    } catch (err) {
      setError(err.message || 'Error al cargar datos')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [subTab, refreshKey])

  // ---- DASHBOARD ----
  const renderDashboard = () => {
    if (!dashboard) return null
    const v = dashboard.ventas || {}
    const c = dashboard.compras || {}
    const cl = dashboard.clientes || {}
    const pres = dashboard.presupuestos || {}

    return (
      <>
        <div className="retail-kpis">
          <div className="retail-kpi">
            <div className="kpi-value">{v.total_pedidos || 0}</div>
            <div className="kpi-label">Pedidos</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value cyan">{fmtMoney(v.total_monto || 0)}</div>
            <div className="kpi-label">Ventas Total</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value amber">{fmtMoney(v.ticket_promedio || 0)}</div>
            <div className="kpi-label">Ticket Promedio</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value green">{v.total_items || 0}</div>
            <div className="kpi-label">Items Vendidos</div>
          </div>
        </div>

        <div className="retail-kpis">
          <div className="retail-kpi">
            <div className="kpi-value" style={{ color: '#f59e0b' }}>{pres.total || 0}</div>
            <div className="kpi-label">Pre Ventas</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value" style={{ color: '#f59e0b' }}>{fmtMoney(pres.monto || 0)}</div>
            <div className="kpi-label">Total Pre Ventas</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value cyan">{cl.total_clientes || 0}</div>
            <div className="kpi-label">Clientes</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value green">{cl.recurrentes || 0}</div>
            <div className="kpi-label">Recurrentes</div>
          </div>
        </div>

        <div className="ventas-period-grid">
          {/* Ventas del Mes */}
          <div className="ventas-period-card">
            <h3>Ventas del Mes</h3>
            <div className="period-total">
              <span className="period-amount">{fmtMoney(dashboard.ventas_mes?.total_monto || 0)}</span>
              <span className="period-count">{dashboard.ventas_mes?.total_pedidos || 0} pedidos</span>
            </div>
            <div className="period-range">
              {fmtDate(dashboard.ventas_mes?.desde)} — {fmtDate(dashboard.ventas_mes?.hasta)}
            </div>
            {dashboard.ventas_mes?.top_ordenes?.length > 0 && (
              <div className="period-orders">
                <div className="period-orders-title">Top 10 órdenes</div>
                {dashboard.ventas_mes.top_ordenes.map((o, i) => (
                  <div key={i} className="period-order-item">
                    <span className="order-rank">#{i + 1}</span>
                    <span className="order-name" title={o.cliente}>{o.cliente}</span>
                    <span className="order-date">{fmtDate(o.fecha)}</span>
                    <span className="order-amount">{fmtMoney(o.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pre Ventas */}
          <div className="ventas-period-card">
            <h3 style={{ color: '#f59e0b' }}>Pre Ventas</h3>
            <div className="period-total">
              <span className="period-amount" style={{ color: '#f59e0b' }}>{fmtMoney(pres.monto || 0)}</span>
              <span className="period-count">{pres.total || 0} pre ventas</span>
            </div>
            <div className="period-range">{pres.total_presupuestos || pres.total || 0} presupuestos</div>
            {pres.top_ordenes?.length > 0 && (
              <div className="period-orders">
                <div className="period-orders-title">Top 10 presupuestos</div>
                {pres.top_ordenes.map((o, i) => (
                  <div key={i} className="period-order-item">
                    <span className="order-rank">#{i + 1}</span>
                    <span className="order-name" title={o.cliente}>{o.cliente}</span>
                    <span className="order-date">{fmtDate(o.fecha)}</span>
                    <span className="order-amount" style={{ color: '#f59e0b' }}>{fmtMoney(o.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {dashboard.top_marcas?.length > 0 && (
          <div className="retail-top-productos">
            <h3>Top Marcas - Venta Mensual</h3>
            {dashboard.top_marcas.filter(m => m.marca && m.marca !== 'Sin marca').map((m, i) => {
              const maxMonto = dashboard.top_marcas[0]?.monto || 1
              const logo = BRAND_LOGOS[m.marca?.toUpperCase()]
              return (
                <div key={i} className="top-prod-item">
                  <span className="top-prod-rank">#{i + 1}</span>
                  {logo ? (
                    <img src={logo} alt={m.marca} className="top-marca-logo" />
                  ) : (
                    <span className="top-prod-name" title={m.marca}>{m.marca}</span>
                  )}
                  <div className="top-prod-bar">
                    <div className="top-prod-bar-fill" style={{ width: `${(m.monto / maxMonto) * 100}%` }} />
                  </div>
                  <span className="top-prod-amount">{fmtMoney(m.monto)}</span>
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

  // ---- TOP MARCAS ----
  const renderTopMarcas = (marcas, title, color) => {
    const filtered = (marcas || []).filter(m => m.marca && m.marca !== 'Sin marca')
    if (!filtered.length) return null
    const maxMonto = filtered[0]?.monto || 1
    return (
      <div className="retail-top-productos">
        <h3 style={color ? { color } : {}}>{title}</h3>
        {filtered.map((m, i) => {
          const logo = BRAND_LOGOS[m.marca?.toUpperCase()]
          return (
            <div key={i} className="top-prod-item">
              <span className="top-prod-rank">#{i + 1}</span>
              {logo ? (
                <img src={logo} alt={m.marca} className="top-marca-logo" />
              ) : (
                <span className="top-prod-name" title={m.marca}>{m.marca}</span>
              )}
              <div className="top-prod-bar">
                <div className="top-prod-bar-fill" style={{ width: `${(m.monto / maxMonto) * 100}%` }} />
              </div>
              <span className="top-prod-amount">{fmtMoney(m.monto)}</span>
            </div>
          )
        })}
      </div>
    )
  }

  // ---- PEDIDOS ----
  const renderPedidos = () => {
    if (!pedidos) return null
    const r = pedidos.resumen || {}
    const list = pedidos.pedidos || []

    return (
      <>
        <h3 style={{ marginBottom: 8 }}>Pedidos</h3>
        <div className="retail-kpis">
          <div className="retail-kpi">
            <div className="kpi-value">{r.total_pedidos || 0}</div>
            <div className="kpi-label">Pedidos</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value cyan">{fmtMoney(r.total_monto || 0)}</div>
            <div className="kpi-label">Total</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value amber">{fmtMoney(r.ticket_promedio || 0)}</div>
            <div className="kpi-label">Ticket Prom.</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value green">{r.total_items || 0}</div>
            <div className="kpi-label">Items</div>
          </div>
        </div>
        {renderTopMarcas(r.top_marcas, 'Top Marcas - Pedidos')}
        <div
          onClick={() => setPedidosOpen(!pedidosOpen)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0', color: '#888', fontSize: '0.85em' }}
        >
          <span style={{ transition: 'transform 0.2s', transform: pedidosOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          {pedidosOpen ? 'Ocultar detalle' : `Ver detalle (${list.length} pedidos)`}
        </div>
        {pedidosOpen && renderOrderTable(list)}

        {/* PRE VENTAS */}
        {preVentas && (() => {
          const pv = preVentas.resumen || {}
          const pvList = preVentas.pedidos || []
          return (
            <>
              <h3 style={{ color: '#f59e0b', marginTop: 24, marginBottom: 8 }}>Pre Ventas</h3>
              <div className="retail-kpis">
                <div className="retail-kpi">
                  <div className="kpi-value" style={{ color: '#f59e0b' }}>{pv.total_pedidos || 0}</div>
                  <div className="kpi-label">Pre Ventas</div>
                </div>
                <div className="retail-kpi">
                  <div className="kpi-value" style={{ color: '#f59e0b' }}>{fmtMoney(pv.total_monto || 0)}</div>
                  <div className="kpi-label">Total</div>
                </div>
                <div className="retail-kpi">
                  <div className="kpi-value" style={{ color: '#f59e0b' }}>{fmtMoney(pv.ticket_promedio || 0)}</div>
                  <div className="kpi-label">Ticket Prom.</div>
                </div>
                <div className="retail-kpi">
                  <div className="kpi-value" style={{ color: '#f59e0b' }}>{pv.total_items || 0}</div>
                  <div className="kpi-label">Items</div>
                </div>
              </div>
              {renderTopMarcas(pv.top_marcas, 'Top Marcas - Pre Ventas', '#f59e0b')}
              <div
                onClick={() => setPreVentasOpen(!preVentasOpen)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 0', color: '#f59e0b', fontSize: '0.85em', opacity: 0.7 }}
              >
                <span style={{ transition: 'transform 0.2s', transform: preVentasOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                {preVentasOpen ? 'Ocultar detalle' : `Ver detalle (${pvList.length} pre ventas)`}
              </div>
              {preVentasOpen && renderOrderTable(pvList)}
            </>
          )
        })()}

      </>
    )
  }

  const renderOrderTable = (list) => (
        <div className="retail-table-wrap">
          <table className="retail-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Importe</th>
                <th>Items</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map(p => {
                const isOpen = !!expandedRows[p.id]
                return (
                  <React.Fragment key={p.id}>
                    <tr
                      className={`pedido-row ${isOpen ? 'expanded' : ''}`}
                      onClick={() => setExpandedRows(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    >
                      <td><span className={`expand-icon ${isOpen ? 'open' : ''}`}>&#9654;</span> {p.numero}</td>
                      <td>{fmtDate(p.fecha)}</td>
                      <td>{p.cliente}</td>
                      <td className="monto">{fmtMoney(p.total)}</td>
                      <td>{p.items}</td>
                      <td><span className={`estado-badge ${p.estado}`}>{p.estado}</span></td>
                    </tr>
                    {isOpen && p.lineas?.length > 0 && (
                      <tr className="pedido-detail-row">
                        <td colSpan={6}>
                          <div className="pedido-detail">
                            <table className="pedido-lineas-table">
                              <thead>
                                <tr>
                                  <th>Producto</th>
                                  <th>Cant.</th>
                                  <th>P. Unit.</th>
                                  <th>Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.lineas.map((ln, j) => (
                                  <tr key={j}>
                                    <td>{ln.producto}</td>
                                    <td>{ln.cantidad}</td>
                                    <td>{fmtMoney(ln.precio_unitario)}</td>
                                    <td className="monto">{fmtMoney(ln.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
  )

  // ---- CLIENTES ----
  const renderClientes = () => {
    if (!clientes) return null
    const r = clientes.resumen || {}
    const list = clientes.clientes || []

    return (
      <>
        <div className="retail-kpis">
          <div className="retail-kpi">
            <div className="kpi-value">{r.total_clientes || 0}</div>
            <div className="kpi-label">Clientes</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value cyan">{fmtMoney(r.monto_total || 0)}</div>
            <div className="kpi-label">Facturado Total</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value green">{r.recurrentes || 0}</div>
            <div className="kpi-label">Recurrentes</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value amber">{fmtMoney(r.ticket_promedio || 0)}</div>
            <div className="kpi-label">Ticket Prom.</div>
          </div>
        </div>

        <div className="retail-table-wrap">
          <table className="retail-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Ciudad</th>
                <th>Compras</th>
                <th>Total</th>
                <th>Ultima Compra</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id}>
                  <td>
                    {c.nombre}
                    {c.total_compras > 1 && (
                      <span className="badge-recurrente" style={{ marginLeft: 6 }}>x{c.total_compras}</span>
                    )}
                  </td>
                  <td>{c.ciudad || c.provincia || '-'}</td>
                  <td>{c.total_compras}</td>
                  <td className="monto">{fmtMoney(c.total_monto)}</td>
                  <td>{fmtDate(c.ultima_compra)}</td>
                  <td style={{ fontSize: '0.8em', color: '#888' }}>{c.email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  return (
    <div className="retail-container">
      <h2>Ventas Retail</h2>

      <div className="retail-controls">
        <label>Desde</label>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <label>Hasta</label>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        <button onClick={fetchData}>Buscar</button>
      </div>

      <div className="retail-subtabs">
        {['dashboard', 'pedidos', 'clientes'].map(t => (
          <button
            key={t}
            className={`retail-subtab ${subTab === t ? 'active' : ''}`}
            onClick={() => setSubTab(t)}
          >
            {t === 'dashboard' ? 'Resumen' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="retail-error">{error}</div>}

      {loading ? (
        <div className="loading-screen">
          <img src="/loading-bg.jpg" alt="" className="loading-bg" />
          <div className="loading-overlay" />
          <div className="loading-content">
            <div className="loading-spinner-ring">
              <div className="ring-segment" />
              <div className="ring-segment" />
              <div className="ring-segment" />
            </div>
            <h1 className="loading-title">Cargando datos<span className="loading-dots" /></h1>
            <p className="loading-subtitle">Trayendo datos de Odoo</p>
          </div>
        </div>
      ) : (
        <>
          {subTab === 'dashboard' && renderDashboard()}
          {subTab === 'pedidos' && renderPedidos()}
          {subTab === 'clientes' && renderClientes()}
        </>
      )}
    </div>
  )
}
