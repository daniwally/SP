import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './VentasRetailTab.css'

const fmtMoney = (n) => '$' + Math.round(n).toLocaleString()
const fmtDate = (d) => {
  if (!d) return '-'
  const parts = String(d).slice(0, 10).split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`
}

export default function VentasRetailTab() {
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
  const [compras, setCompras] = useState(null)
  const [clientes, setClientes] = useState(null)
  const [expandedRows, setExpandedRows] = useState({})

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
        const res = await axios.get(API + '/pedidos' + params, { timeout: 30000 })
        if (res.data.error) setError(res.data.error)
        setPedidos(res.data)
      } else if (subTab === 'compras') {
        const res = await axios.get(API + '/compras' + params, { timeout: 30000 })
        if (res.data.error) setError(res.data.error)
        setCompras(res.data)
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
  }, [subTab])

  // ---- DASHBOARD ----
  const renderDashboard = () => {
    if (!dashboard) return null
    const v = dashboard.ventas || {}
    const c = dashboard.compras || {}
    const cl = dashboard.clientes || {}

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
            <div className="kpi-value" style={{ color: '#ef4444' }}>{c.total_compras || 0}</div>
            <div className="kpi-label">Ord. Compra</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value" style={{ color: '#ef4444' }}>{fmtMoney(c.total_monto || 0)}</div>
            <div className="kpi-label">Total Compras</div>
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
          {/* Ventas de la Semana */}
          <div className="ventas-period-card">
            <h3>Ventas de la Semana</h3>
            <div className="period-total">
              <span className="period-amount">{fmtMoney(dashboard.ventas_semana?.total_monto || 0)}</span>
              <span className="period-count">{dashboard.ventas_semana?.total_pedidos || 0} pedidos</span>
            </div>
            <div className="period-range">
              {fmtDate(dashboard.ventas_semana?.desde)} — {fmtDate(dashboard.ventas_semana?.hasta)}
            </div>
            {dashboard.ventas_semana?.top_ordenes?.length > 0 && (
              <div className="period-orders">
                <div className="period-orders-title">Top 10 órdenes</div>
                {dashboard.ventas_semana.top_ordenes.map((o, i) => (
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
        </div>
      </>
    )
  }

  // ---- PEDIDOS ----
  const renderPedidos = () => {
    if (!pedidos) return null
    const r = pedidos.resumen || {}
    const list = pedidos.pedidos || []

    return (
      <>
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

        {pedidos.resumen?.top_marcas?.length > 0 && (
          <div className="retail-top-productos">
            <h3>Top Marcas</h3>
            {pedidos.resumen.top_marcas.map((m, i) => {
              const maxMonto = pedidos.resumen.top_marcas[0]?.monto || 1
              return (
                <div key={i} className="top-marca-group">
                  <div className="top-prod-item">
                    <span className="top-prod-rank">#{i + 1}</span>
                    <span className="top-prod-name" title={m.marca}>{m.marca}</span>
                    <span style={{ color: '#888', fontSize: '0.8em', minWidth: 40 }}>{Math.round(m.cantidad)}u</span>
                    <div className="top-prod-bar">
                      <div className="top-prod-bar-fill" style={{ width: `${(m.monto / maxMonto) * 100}%` }} />
                    </div>
                    <span className="top-prod-amount">{fmtMoney(m.monto)}</span>
                  </div>
                  {m.top_productos?.length > 0 && (
                    <div className="marca-productos">
                      {m.top_productos.map((tp, j) => (
                        <div key={j} className="marca-prod-item">
                          <span className="marca-prod-name">{tp.producto}</span>
                          <span className="marca-prod-qty">{Math.round(tp.cantidad)}u</span>
                          <span className="marca-prod-amount">{fmtMoney(tp.monto)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

  // ---- COMPRAS ----
  const renderCompras = () => {
    if (!compras) return null
    const r = compras.resumen || {}
    const list = compras.compras || []

    return (
      <>
        <div className="retail-kpis">
          <div className="retail-kpi">
            <div className="kpi-value" style={{ color: '#ef4444' }}>{r.total_compras || 0}</div>
            <div className="kpi-label">Ord. de Compra</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value" style={{ color: '#ef4444' }}>{fmtMoney(r.total_monto || 0)}</div>
            <div className="kpi-label">Total Invertido</div>
          </div>
          <div className="retail-kpi">
            <div className="kpi-value amber">{fmtMoney(r.compra_promedio || 0)}</div>
            <div className="kpi-label">Compra Prom.</div>
          </div>
        </div>

        <div className="retail-table-wrap">
          <table className="retail-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Items</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id}>
                  <td>{c.numero}</td>
                  <td>{fmtDate(c.fecha)}</td>
                  <td>{c.proveedor}</td>
                  <td>{c.items}</td>
                  <td className="monto red">{fmtMoney(c.total)}</td>
                  <td><span className={`estado-badge ${c.estado}`}>{c.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

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
        {['dashboard', 'pedidos', 'compras', 'clientes'].map(t => (
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
        <div className="retail-loading">
          <div className="spinner" />
          Cargando datos de Odoo...
        </div>
      ) : (
        <>
          {subTab === 'dashboard' && renderDashboard()}
          {subTab === 'pedidos' && renderPedidos()}
          {subTab === 'compras' && renderCompras()}
          {subTab === 'clientes' && renderClientes()}
        </>
      )}
    </div>
  )
}
