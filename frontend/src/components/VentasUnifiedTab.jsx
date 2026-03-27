import { useState, useEffect } from 'react'
import axios from 'axios'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const LOGO_BASE = 'https://raw.githubusercontent.com/daniwally/SP/main/logos'
const BRAND_LOGOS = {
  'SHAQ': `${LOGO_BASE}/shaq-logo.png`,
  'STARTER': `${LOGO_BASE}/starter.png`,
  'HYDRATE': `${LOGO_BASE}/hydrate-logo.png`,
  'TIMBERLAND': `${LOGO_BASE}/TBL-logo.png`,
  'URBAN_FLOW': `${LOGO_BASE}/urban-flow-logo.png`,
  'ELSYS': `${LOGO_BASE}/elsys-logo.png`,
}

const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('es-AR')

const BRAND_COLORS = {
  'SHAQ': '#f59e0b',
  'STARTER': '#06b6d4',
  'HYDRATE': '#22c55e',
  'TIMBERLAND': '#a855f7',
  'URBAN_FLOW': '#ef4444',
}

export default function VentasUnifiedTab({ testData }) {
  const [retailData, setRetailData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dailyData, setDailyData] = useState(null)

  useEffect(() => {
    const fetchRetail = async () => {
      try {
        setLoading(true)
        const API = window.location.origin + '/api/retail'
        const today = new Date().toISOString().slice(0, 10)
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
        const params = `?desde=${firstOfMonth}&hasta=${today}`
        const res = await axios.get(API + '/dashboard' + params, { timeout: 30000 })
        setRetailData(res.data)
      } catch (err) {
        console.error('Error fetching retail data:', err)
      }
      setLoading(false)
    }
    fetchRetail()
  }, [])

  useEffect(() => {
    const API = window.location.origin + '/api/test'
    axios.get(API + '/ventas-diarias', { timeout: 60000 })
      .then(res => setDailyData(res.data))
      .catch(err => console.error('Error fetching daily data:', err))
  }, [])

  // E-commerce totals
  const ecomSemana = testData?.totales?.semana?.total || 0
  const ecomSemanaOrdenes = testData?.totales?.semana?.ordenes || 0
  const ecomMes = testData?.totales?.mes?.total || 0
  const ecomMesOrdenes = testData?.totales?.mes?.ordenes || 0
  const ecomHoy = testData?.totales?.hoy?.total || 0
  const ecomHoyOrdenes = testData?.totales?.hoy?.ordenes || 0

  // Retail totals
  const retailSemana = retailData?.ventas_semana?.total_monto || 0
  const retailSemanaPedidos = retailData?.ventas_semana?.total_pedidos || 0
  const retailMes = retailData?.ventas_mes?.total_monto || 0
  const retailMesPedidos = retailData?.ventas_mes?.total_pedidos || 0

  // Combined
  const totalSemana = ecomSemana + retailSemana
  const totalMes = ecomMes + retailMes

  // % share
  const ecomPctSemana = totalSemana > 0 ? ((ecomSemana / totalSemana) * 100).toFixed(1) : 0
  const retailPctSemana = totalSemana > 0 ? ((retailSemana / totalSemana) * 100).toFixed(1) : 0
  const ecomPctMes = totalMes > 0 ? ((ecomMes / totalMes) * 100).toFixed(1) : 0
  const retailPctMes = totalMes > 0 ? ((retailMes / totalMes) * 100).toFixed(1) : 0

  // Brand breakdown e-commerce
  const ecomBrandsSemana = Object.entries(testData?.semana || {}).sort(([,a],[,b]) => (b.total||0) - (a.total||0))
  const ecomBrandsMes = Object.entries(testData?.mes || {}).sort(([,a],[,b]) => (b.total||0) - (a.total||0))

  // Brand breakdown retail
  const retailBrands = retailData?.top_marcas || []

  const cardStyle = {
    background: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '16px',
    border: '1px solid rgba(217, 70, 239, 0.2)',
    padding: '24px',
  }

  const kpiBoxStyle = (color) => ({
    background: 'rgba(0,0,0,0.4)',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    border: `1px solid ${color}33`,
  })

  if (loading) {
    return (
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
          <p className="loading-subtitle">Trayendo datos de Mercado Libre</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* HEADER - TOTAL CONSOLIDADO */}
      <section className="section" style={{ marginBottom: '0' }}>
        <h2 style={{ marginBottom: '24px' }}>📊 Resumen de Ventas — E-commerce vs Retail</h2>

        {/* KPI TOTALES GRANDES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

          {/* SEMANA */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ color: '#fff', fontSize: '1.3em', fontWeight: 800, margin: '0 0 4px 0' }}>Últimos 7 Días</h3>
            <p style={{ color: '#fbbf24', fontSize: '0.78em', fontWeight: 600, margin: '0 0 16px 0' }}>
              {(() => {
                const today = new Date()
                const hace7 = new Date(today)
                hace7.setDate(hace7.getDate() - 7)
                const fmt = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                return `${fmt(hace7)} - ${fmt(today)}`
              })()}
            </p>

            {/* Total combinado */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <p style={{ color: '#7f8c8d', fontSize: '0.85em', fontWeight: 600, marginBottom: '4px' }}>TOTAL COMBINADO</p>
              <p style={{ fontSize: '2.1em', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #d946ef, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {fmtMoney(totalSemana)}
              </p>
            </div>

            {/* E-commerce vs Retail */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={kpiBoxStyle('#d946ef')}>
                <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, margin: '0 0 6px 0' }}>E-COMMERCE (ML)</p>
                <p style={{ color: '#d946ef', fontSize: '1.35em', fontWeight: 800, margin: 0 }}>{fmtMoney(ecomSemana)}</p>
                <p style={{ color: '#fbbf24', fontSize: '0.8em', margin: '6px 0 0 0', fontWeight: 700 }}>{ecomSemanaOrdenes} órdenes</p>
              </div>
              <div style={kpiBoxStyle('#06b6d4')}>
                <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, margin: '0 0 6px 0' }}>RETAIL (ODOO)</p>
                <p style={{ color: '#06b6d4', fontSize: '1.35em', fontWeight: 800, margin: 0 }}>{fmtMoney(retailSemana)}</p>
                <p style={{ color: '#fbbf24', fontSize: '0.8em', margin: '6px 0 0 0', fontWeight: 700 }}>{retailSemanaPedidos} pedidos</p>
              </div>
            </div>

            {/* Barra comparativa */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: '#b0b0c0', marginBottom: '6px' }}>
                <span>E-commerce {ecomPctSemana}%</span>
                <span>Retail {retailPctSemana}%</span>
              </div>
              <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ width: `${ecomPctSemana}%`, background: 'linear-gradient(90deg, #d946ef, #a855f7)', transition: 'width 0.6s' }} />
                <div style={{ width: `${retailPctSemana}%`, background: 'linear-gradient(90deg, #06b6d4, #22d3ee)', transition: 'width 0.6s' }} />
              </div>
            </div>
          </div>

          {/* MES */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ color: '#fff', fontSize: '1.3em', fontWeight: 800, margin: '0 0 4px 0' }}>Acumulado del Mes</h3>
            <p style={{ color: '#fbbf24', fontSize: '0.78em', fontWeight: 600, margin: '0 0 16px 0' }}>
              {(() => {
                const today = new Date()
                const inicio = new Date(today.getFullYear(), today.getMonth(), 1)
                const fmt = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                return `${fmt(inicio)} - ${fmt(today)}`
              })()}
            </p>

            {/* Total combinado */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <p style={{ color: '#7f8c8d', fontSize: '0.85em', fontWeight: 600, marginBottom: '4px' }}>TOTAL COMBINADO</p>
              <p style={{ fontSize: '2.1em', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #d946ef, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {fmtMoney(totalMes)}
              </p>
            </div>

            {/* E-commerce vs Retail */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={kpiBoxStyle('#d946ef')}>
                <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, margin: '0 0 6px 0' }}>E-COMMERCE (ML)</p>
                <p style={{ color: '#d946ef', fontSize: '1.35em', fontWeight: 800, margin: 0 }}>{fmtMoney(ecomMes)}</p>
                <p style={{ color: '#fbbf24', fontSize: '0.8em', margin: '6px 0 0 0', fontWeight: 700 }}>{ecomMesOrdenes} órdenes</p>
              </div>
              <div style={kpiBoxStyle('#06b6d4')}>
                <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, margin: '0 0 6px 0' }}>RETAIL (ODOO)</p>
                <p style={{ color: '#06b6d4', fontSize: '1.35em', fontWeight: 800, margin: 0 }}>{fmtMoney(retailMes)}</p>
                <p style={{ color: '#fbbf24', fontSize: '0.8em', margin: '6px 0 0 0', fontWeight: 700 }}>{retailMesPedidos} pedidos</p>
              </div>
            </div>

            {/* Barra comparativa */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: '#b0b0c0', marginBottom: '6px' }}>
                <span>E-commerce {ecomPctMes}%</span>
                <span>Retail {retailPctMes}%</span>
              </div>
              <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ width: `${ecomPctMes}%`, background: 'linear-gradient(90deg, #d946ef, #a855f7)', transition: 'width 0.6s' }} />
                <div style={{ width: `${retailPctMes}%`, background: 'linear-gradient(90deg, #06b6d4, #22d3ee)', transition: 'width 0.6s' }} />
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* GRÁFICO DE VENTAS DIARIAS */}
      {dailyData && dailyData.dias && (
        <section className="section" style={{ marginTop: '0', marginBottom: '0' }}>
          <h2 style={{ marginBottom: '16px' }}>Variación Diaria de Ventas — Mes Actual</h2>
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Line
              data={{
                labels: dailyData.dias.map(d => {
                  const parts = d.split('-')
                  return `${parts[2]}/${parts[1]}`
                }),
                datasets: Object.entries(dailyData.marcas || {}).map(([marca, datos]) => ({
                  label: marca,
                  data: datos.map(d => d.total),
                  borderColor: BRAND_COLORS[marca] || '#888',
                  backgroundColor: (BRAND_COLORS[marca] || '#888') + '15',
                  borderWidth: 2,
                  pointRadius: 3,
                  pointHoverRadius: 6,
                  tension: 0.3,
                  fill: false,
                })),
              }}
              options={{
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                  legend: {
                    position: 'top',
                    labels: { color: '#b0b0c0', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } },
                  },
                  tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    titleColor: '#fff',
                    bodyColor: '#b0b0c0',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                      label: (ctx) => `${ctx.dataset.label}: $${Math.round(ctx.parsed.y).toLocaleString('es-AR')}`,
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: '#666', font: { size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                  },
                  y: {
                    ticks: {
                      color: '#666',
                      font: { size: 11 },
                      callback: (v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`,
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                  },
                },
              }}
            />
          </div>
        </section>
      )}

      {/* DESGLOSE POR MARCA */}
      <section className="section" style={{ marginTop: '0' }}>
        <h2 style={{ marginBottom: '24px' }}>Desglose por Marca</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* E-COMMERCE POR MARCA - SEMANA */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ color: '#d946ef', fontSize: '1.1em', fontWeight: 800, margin: '0 0 16px 0' }}>
              E-commerce — Últimos 7 Días
            </h3>
            {ecomBrandsSemana.map(([marca, data]) => {
              const maxVal = ecomBrandsSemana[0]?.[1]?.total || 1
              const logo = BRAND_LOGOS[marca]
              return (
                <div key={marca} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  {logo ? (
                    <img src={logo} alt={marca} style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px' }} />
                  ) : (
                    <span style={{ color: '#06b6d4', fontWeight: 700, fontSize: '0.85em', minWidth: '32px' }}>{marca}</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#fff', fontSize: '0.85em', fontWeight: 600 }}>{marca}</span>
                      <span style={{ color: '#d946ef', fontSize: '0.85em', fontWeight: 700 }}>{fmtMoney(data.total || 0)}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{ width: `${((data.total || 0) / maxVal) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #d946ef, #a855f7)', borderRadius: '3px' }} />
                    </div>
                    <p style={{ color: '#7f8c8d', fontSize: '0.7em', margin: '3px 0 0 0' }}>{data.ordenes || 0} órdenes · Prom: {fmtMoney(data.promedio || 0)}</p>
                  </div>
                </div>
              )
            })}
            <div style={{ background: 'rgba(217, 70, 239, 0.15)', padding: '10px', borderRadius: '8px', marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: '#d946ef', fontWeight: 800, fontSize: '1.1em' }}>Total: {fmtMoney(ecomSemana)}</span>
            </div>
          </div>

          {/* RETAIL POR MARCA - MES */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ color: '#06b6d4', fontSize: '1.1em', fontWeight: 800, margin: '0 0 16px 0' }}>
              Retail — Acumulado del Mes
            </h3>
            {retailBrands.map((m, i) => {
              const maxVal = retailBrands[0]?.monto || 1
              const logo = BRAND_LOGOS[m.marca?.toUpperCase()]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  {logo ? (
                    <img src={logo} alt={m.marca} style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px' }} />
                  ) : (
                    <span style={{ color: '#06b6d4', fontWeight: 700, fontSize: '0.85em', minWidth: '32px' }}>{m.marca}</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#fff', fontSize: '0.85em', fontWeight: 600 }}>{m.marca}</span>
                      <span style={{ color: '#06b6d4', fontSize: '0.85em', fontWeight: 700 }}>{fmtMoney(m.monto)}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{ width: `${(m.monto / maxVal) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #06b6d4, #22d3ee)', borderRadius: '3px' }} />
                    </div>
                  </div>
                </div>
              )
            })}
            {retailBrands.length === 0 && (
              <p style={{ color: '#7f8c8d', textAlign: 'center', padding: '20px' }}>Sin datos de marcas retail</p>
            )}
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '10px', borderRadius: '8px', marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: '#06b6d4', fontWeight: 800, fontSize: '1.1em' }}>Total: {fmtMoney(retailMes)}</span>
            </div>
          </div>

          {/* E-COMMERCE POR MARCA - MES */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ color: '#d946ef', fontSize: '1.1em', fontWeight: 800, margin: '0 0 16px 0' }}>
              E-commerce — Acumulado del Mes
            </h3>
            {ecomBrandsMes.map(([marca, data]) => {
              const maxVal = ecomBrandsMes[0]?.[1]?.total || 1
              const logo = BRAND_LOGOS[marca]
              return (
                <div key={marca} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  {logo ? (
                    <img src={logo} alt={marca} style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px' }} />
                  ) : (
                    <span style={{ color: '#06b6d4', fontWeight: 700, fontSize: '0.85em', minWidth: '32px' }}>{marca}</span>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#fff', fontSize: '0.85em', fontWeight: 600 }}>{marca}</span>
                      <span style={{ color: '#d946ef', fontSize: '0.85em', fontWeight: 700 }}>{fmtMoney(data.total || 0)}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{ width: `${((data.total || 0) / maxVal) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #d946ef, #a855f7)', borderRadius: '3px' }} />
                    </div>
                    <p style={{ color: '#7f8c8d', fontSize: '0.7em', margin: '3px 0 0 0' }}>{data.ordenes || 0} órdenes · Prom: {fmtMoney(data.promedio || 0)}</p>
                  </div>
                </div>
              )
            })}
            <div style={{ background: 'rgba(217, 70, 239, 0.15)', padding: '10px', borderRadius: '8px', marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: '#d946ef', fontWeight: 800, fontSize: '1.1em' }}>Total: {fmtMoney(ecomMes)}</span>
            </div>
          </div>

          {/* COMPARATIVO COMBINADO POR MARCA - MES */}
          <div style={{ ...cardStyle }}>
            <h3 style={{ color: '#fbbf24', fontSize: '1.1em', fontWeight: 800, margin: '0 0 16px 0' }}>
              Comparativo por Marca — Mes
            </h3>
            {(() => {
              // Merge brands from both sources
              const allBrands = {}
              Object.entries(testData?.mes || {}).forEach(([marca, data]) => {
                allBrands[marca] = { ecom: data.total || 0, retail: 0 }
              })
              retailBrands.forEach(m => {
                const key = m.marca?.toUpperCase() || m.marca
                if (allBrands[key]) {
                  allBrands[key].retail = m.monto || 0
                } else {
                  allBrands[key] = { ecom: 0, retail: m.monto || 0 }
                }
              })
              const sorted = Object.entries(allBrands).sort(([,a],[,b]) => (b.ecom + b.retail) - (a.ecom + a.retail))
              const maxTotal = sorted[0] ? (sorted[0][1].ecom + sorted[0][1].retail) : 1

              return sorted.map(([marca, vals]) => {
                const logo = BRAND_LOGOS[marca]
                const brandTotal = vals.ecom + vals.retail
                const ecomPct = brandTotal > 0 ? (vals.ecom / brandTotal * 100).toFixed(0) : 0
                const retailPct = brandTotal > 0 ? (vals.retail / brandTotal * 100).toFixed(0) : 0
                return (
                  <div key={marca} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      {logo ? (
                        <img src={logo} alt={marca} style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }} />
                      ) : (
                        <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.8em', minWidth: '28px' }}>{marca}</span>
                      )}
                      <span style={{ color: '#fff', fontSize: '0.85em', fontWeight: 600 }}>{marca}</span>
                      <span style={{ marginLeft: 'auto', color: '#fbbf24', fontWeight: 800, fontSize: '0.9em' }}>{fmtMoney(brandTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ width: `${(vals.ecom / maxTotal) * 100}%`, background: '#d946ef', transition: 'width 0.5s' }} />
                      <div style={{ width: `${(vals.retail / maxTotal) * 100}%`, background: '#06b6d4', transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7em', marginTop: '3px' }}>
                      <span style={{ color: '#d946ef' }}>ML: {fmtMoney(vals.ecom)} ({ecomPct}%)</span>
                      <span style={{ color: '#06b6d4' }}>Retail: {fmtMoney(vals.retail)} ({retailPct}%)</span>
                    </div>
                  </div>
                )
              })
            })()}
            <div style={{ background: 'rgba(251, 191, 36, 0.12)', padding: '10px', borderRadius: '8px', marginTop: '12px', textAlign: 'center' }}>
              <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '1.1em' }}>Gran Total: {fmtMoney(totalMes)}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
