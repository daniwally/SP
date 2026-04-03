import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './MercadoPagoTab.css'

const LOGO_BASE = 'https://raw.githubusercontent.com/daniwally/SP/main/logos'
const BRAND_LOGOS = {
  'SHAQ': `${LOGO_BASE}/shaq-logo.png`,
  'STARTER': `${LOGO_BASE}/starter.png`,
  'HYDRATE': `${LOGO_BASE}/hydrate-logo.png`,
  'TIMBERLAND': `${LOGO_BASE}/TBL-logo.png`,
  'URBAN_FLOW': `${LOGO_BASE}/urban-flow-logo.png`,
}

const fmtMoney = (n) => {
  const s = Math.round(n).toString()
  if (s.length <= 3) return s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return rest + ',' + last3
}

const fmtDate = (d) => {
  if (!d) return '-'
  const parts = String(d).slice(0, 10).split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`
}

const METHOD_LABELS = {
  'credit_card': 'Tarjeta Crédito',
  'debit_card': 'Tarjeta Débito',
  'account_money': 'Dinero en cuenta',
  'bank_transfer': 'Transferencia',
  'ticket': 'Efectivo',
  'atm': 'ATM',
  'digital_currency': 'Cripto',
  'digital_wallet': 'Billetera Digital',
}

export default function MercadoPagoTab({ refreshKey = 0 }) {
  const [loading, setLoading] = useState(true)
  const [loadingBg, setLoadingBg] = useState(null)
  const [error, setError] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [listOpen, setListOpen] = useState(false)

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)

  const API = window.location.origin + '/api/mp'

  useEffect(() => {
    fetch('/api/screens').then(r => r.json()).then(data => {
      if (data.screens && data.screens.length > 0) {
        setLoadingBg(data.screens[Math.floor(Math.random() * data.screens.length)])
      } else {
        setLoadingBg('/on-loading-bg.jpg')
      }
    }).catch(() => setLoadingBg('/on-loading-bg.jpg'))
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get(`${API}/dashboard?desde=${desde}&hasta=${hasta}`, { timeout: 60000 })
      setDashboard(res.data)
      if (res.data.errors?.length) {
        setError(res.data.errors.join(' | '))
      }
    } catch (err) {
      setError(err.message || 'Error al cargar datos')
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [refreshKey])

  // Filter data by selected brand
  const getFilteredData = () => {
    if (!dashboard) return null
    if (!selectedBrand) return dashboard.totals
    const brand = dashboard.brands?.[selectedBrand]
    if (!brand?.payments) return null
    const p = brand.payments
    return {
      approved: p.approved?.amount || 0,
      approved_count: p.approved?.count || 0,
      pending: p.pending?.amount || 0,
      pending_count: p.pending?.count || 0,
      rejected: p.rejected?.amount || 0,
      rejected_count: p.rejected?.count || 0,
      refunded: p.refunded?.amount || 0,
      refunded_count: p.refunded?.count || 0,
      fees: p.fees || 0,
      net: p.net || 0,
      chargebacks: sum_chargebacks(brand),
      chargebacks_count: brand.chargebacks?.total || 0,
    }
  }

  const sum_chargebacks = (brand) => {
    if (!brand?.chargebacks?.chargebacks) return 0
    return brand.chargebacks.chargebacks.reduce((s, c) => s + (c.amount || 0), 0)
  }

  const getFilteredPayments = () => {
    if (!dashboard) return []
    if (!selectedBrand) {
      // Merge all brands' payments
      const all = []
      Object.entries(dashboard.brands || {}).forEach(([marca, data]) => {
        (data?.payments?.payments || []).forEach(p => all.push({ ...p, marca }))
      })
      return all.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    }
    const brand = dashboard.brands?.[selectedBrand]
    return (brand?.payments?.payments || []).map(p => ({ ...p, marca: selectedBrand }))
  }

  const getFilteredMethods = () => {
    if (!dashboard) return {}
    if (!selectedBrand) return dashboard.methods || {}
    return dashboard.brands?.[selectedBrand]?.payments?.methods || {}
  }

  const totals = getFilteredData()
  const payments = getFilteredPayments()
  const methods = getFilteredMethods()

  if (loading) {
    return (
      <div className="loading-screen">
        {loadingBg && <img src={loadingBg} alt="" className="loading-bg" />}
        <div className="loading-overlay" />
        <div className="loading-content">
          <h1 className="brand-logo" style={{ fontSize: '4em', margin: '0', lineHeight: '1' }}><span className="brand-command">ONEMANDO</span><span className="brand-dot">.</span><span className="brand-ai">ai</span></h1>
          <p className="loading-tagline" style={{ marginTop: '-2px' }}>EL CONTROL, HECHO SISTEMA.</p>
          <div className="loading-spinner-ring" style={{ marginTop: '20px' }}>
            <div className="ring-segment" />
            <div className="ring-segment" />
            <div className="ring-segment" />
          </div>
          <h1 className="loading-title">Cargando datos<span className="loading-dots" /></h1>
        </div>
      </div>
    )
  }

  return (
    <div className="mp-container">
      <h2>MercadoPago</h2>

      {/* Controls */}
      <div className="mp-controls">
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        <button onClick={fetchData}>Buscar</button>
      </div>

      {/* Brand filter */}
      <div className="mp-brands">
        <button
          className={`mp-brand-btn ${!selectedBrand ? 'active' : ''}`}
          onClick={() => setSelectedBrand(null)}
        >Todas</button>
        {Object.keys(dashboard?.brands || {}).map(marca => (
          <button
            key={marca}
            className={`mp-brand-btn ${selectedBrand === marca ? 'active' : ''}`}
            onClick={() => setSelectedBrand(selectedBrand === marca ? null : marca)}
          >
            {BRAND_LOGOS[marca] ? (
              <img src={BRAND_LOGOS[marca]} alt={marca} className="mp-brand-logo" />
            ) : marca}
          </button>
        ))}
      </div>

      {error && <div className="mp-error">{error}</div>}

      {totals && (
        <>
          {/* KPI Cards */}
          <div className="mp-kpis">
            <div className="mp-kpi">
              <div className="mp-kpi-value green">${fmtMoney(totals.approved || 0)}</div>
              <div className="mp-kpi-sub">{totals.approved_count || 0} cobros</div>
              <div className="mp-kpi-label">Aprobados</div>
            </div>
            <div className="mp-kpi">
              <div className="mp-kpi-value cyan">${fmtMoney(totals.net || 0)}</div>
              <div className="mp-kpi-sub">-${fmtMoney(totals.fees || 0)} comisiones</div>
              <div className="mp-kpi-label">Neto</div>
            </div>
            <div className="mp-kpi">
              <div className="mp-kpi-value amber">${fmtMoney(totals.pending || 0)}</div>
              <div className="mp-kpi-sub">{totals.pending_count || 0} pendientes</div>
              <div className="mp-kpi-label">Pendientes</div>
            </div>
            <div className="mp-kpi">
              <div className="mp-kpi-value red">${fmtMoney(totals.rejected || 0)}</div>
              <div className="mp-kpi-sub">{totals.rejected_count || 0} rechazados</div>
              <div className="mp-kpi-label">Rechazados</div>
            </div>
          </div>

          {/* Refunds & Chargebacks */}
          <div className="mp-kpis mp-kpis-secondary">
            <div className="mp-kpi">
              <div className="mp-kpi-value" style={{ color: '#f97316' }}>${fmtMoney(totals.refunded || 0)}</div>
              <div className="mp-kpi-sub">{totals.refunded_count || 0} devoluciones</div>
              <div className="mp-kpi-label">Reembolsos</div>
            </div>
            <div className="mp-kpi">
              <div className="mp-kpi-value red">${fmtMoney(totals.chargebacks || 0)}</div>
              <div className="mp-kpi-sub">{totals.chargebacks_count || 0} contracargos</div>
              <div className="mp-kpi-label">Contracargos</div>
            </div>
            <div className="mp-kpi">
              <div className="mp-kpi-value" style={{ color: '#8b5cf6' }}>${fmtMoney(totals.fees || 0)}</div>
              <div className="mp-kpi-label">Comisiones MP</div>
            </div>
          </div>

          {/* Payment Methods */}
          {Object.keys(methods).length > 0 && (
            <div className="mp-methods-card">
              <h3>Medios de Pago</h3>
              <div className="mp-methods-grid">
                {Object.entries(methods).sort((a, b) => b[1] - a[1]).map(([method, count]) => (
                  <div key={method} className="mp-method-item">
                    <span className="mp-method-name">{METHOD_LABELS[method] || method}</span>
                    <span className="mp-method-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brand breakdown (when showing all) */}
          {!selectedBrand && dashboard?.brands && (
            <div className="mp-brands-grid">
              {Object.entries(dashboard.brands).filter(([, d]) => d?.payments && !d.error).map(([marca, data]) => {
                const p = data.payments
                return (
                  <div key={marca} className="mp-brand-card" onClick={() => setSelectedBrand(marca)}>
                    <div className="mp-brand-card-header">
                      {BRAND_LOGOS[marca] ? (
                        <img src={BRAND_LOGOS[marca]} alt={marca} className="mp-brand-card-logo" />
                      ) : (
                        <span style={{ color: '#fff', fontWeight: 700 }}>{marca}</span>
                      )}
                    </div>
                    <div className="mp-brand-card-amount">${fmtMoney(p.approved?.amount || 0)}</div>
                    <div className="mp-brand-card-count">{p.approved?.count || 0} cobros</div>
                    {p.net > 0 && <div className="mp-brand-card-net">Neto: ${fmtMoney(p.net)}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Payments list */}
          {payments.length > 0 && (
            <div className="mp-list-card">
              <h3
                onClick={() => setListOpen(!listOpen)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>Listado de Cobros ({payments.length})</span>
                <span style={{ fontSize: '0.8em', color: '#666', transition: 'transform 0.2s', transform: listOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </h3>
              {listOpen && (
                <div className="mp-table-wrap">
                  <table className="mp-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Marca</th>
                        <th>Importe</th>
                        <th>Estado</th>
                        <th>Medio</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.slice(0, 100).map((p, i) => (
                        <tr key={i}>
                          <td>{fmtDate(p.date)}</td>
                          <td>
                            {BRAND_LOGOS[p.marca] ? (
                              <img src={BRAND_LOGOS[p.marca]} alt={p.marca} style={{ height: '16px', maxWidth: '60px', objectFit: 'contain' }} />
                            ) : p.marca}
                          </td>
                          <td className={`mp-amount ${p.status === 'approved' ? 'green' : p.status === 'rejected' ? 'red' : ''}`}>
                            ${fmtMoney(p.amount || 0)}
                          </td>
                          <td>
                            <span className={`mp-status-badge ${p.status}`}>
                              {p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : p.status === 'rejected' ? 'Rechazado' : p.status === 'refunded' ? 'Reembolsado' : p.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85em', color: '#888' }}>{METHOD_LABELS[p.payment_type] || p.payment_type}</td>
                          <td style={{ fontSize: '0.8em', color: '#666', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payments.length > 100 && (
                    <p style={{ color: '#666', fontSize: '0.8em', textAlign: 'center', marginTop: '8px' }}>Mostrando 100 de {payments.length} cobros</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!totals && !error && (
        <div className="mp-empty">
          <p>Sin datos de MercadoPago.</p>
          <p style={{ fontSize: '0.85em', color: '#666' }}>Configurá los tokens MP_ACCESS_TOKEN en las variables de entorno.</p>
        </div>
      )}
    </div>
  )
}
