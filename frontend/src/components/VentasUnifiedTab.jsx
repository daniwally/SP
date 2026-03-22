import { useState, useEffect } from 'react'
import axios from 'axios'

const LOGO_BASE = 'https://raw.githubusercontent.com/daniwally/SP/main/logos'
const BRAND_LOGOS = {
  'SHAQ': `${LOGO_BASE}/shaq-logo.png`,
  'STARTER': `${LOGO_BASE}/starter.png`,
  'HYDRATE': `${LOGO_BASE}/hydrate-logo.png`,
  'TIMBERLAND': `${LOGO_BASE}/TBL-logo.png`,
  'URBAN_FLOW': `${LOGO_BASE}/urban-flow-logo.png`,
  'ELSYS': `${LOGO_BASE}/elsys-logo.png`,
}

const fmtMoney = (n) => '$' + Math.round(n).toLocaleString()

export default function VentasUnifiedTab({ testData }) {
  const [retailData, setRetailData] = useState(null)
  const [loading, setLoading] = useState(true)

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
      <section className="section">
        <div style={{ textAlign: 'center', padding: '60px', color: '#b0b0c0' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p>Cargando datos de ventas...</p>
        </div>
      </section>
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
            <h3 style={{ color: '#fff', fontSize: '1.3em', fontWeight: 800, margin: '0 0 20px 0' }}>Últimos 7 Días</h3>

            {/* Total combinado */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <p style={{ color: '#7f8c8d', fontSize: '0.85em', fontWeight: 600, marginBottom: '4px' }}>TOTAL COMBINADO</p>
              <p style={{ fontSize: '2.8em', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #d946ef, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {fmtMoney(totalSemana)}
              </p>
            </div>

            {/* E-commerce vs Retail */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={kpiBoxStyle('#d946ef')}>
                <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, margin: '0 0 6px 0' }}>E-COMMERCE (ML)</p>
                <p style={{ color: '#d946ef', fontSize: '1.8em', fontWeight: 800, margin: 0 }}>{fmtMoney(ecomSemana)}</p>
                <p style={{ color: '#fbbf24', fontSize: '0.8em', margin: '6px 0 0 0', fontWeight: 700 }}>{ecomSemanaOrdenes} órdenes</p>
              </div>
              <div style={kpiBoxStyle('#06b6d4')}>
                <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, margin: '0 0 6px 0' }}>RETAIL (ODOO)</p>
                <p style={{ color: '#06b6d4', fontSize: '1.8em', fontWeight: 800, margin: 0 }}>{fmtMoney(retailSemana)}</p>
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
            <h3 style={{ color: '#fff', fontSize: '1.3em', fontWeight: 800, margin: '0 0 20px 0' }}>Acumulado del Mes</h3>

            {/* Total combinado */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <p style={{ color: '#7f8c8d', fontSize: '0.85em', fontWeight: 600, marginBottom: '4px' }}>TOTAL COMBINADO</p>
              <p style={{ fontSize: '2.8em', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #d946ef, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {fmtMoney(totalMes)}
              </p>
            </div>

            {/* E-commerce vs Retail */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={kpiBoxStyle('#d946ef')}>
                <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, margin: '0 0 6px 0' }}>E-COMMERCE (ML)</p>
                <p style={{ color: '#d946ef', fontSize: '1.8em', fontWeight: 800, margin: 0 }}>{fmtMoney(ecomMes)}</p>
                <p style={{ color: '#fbbf24', fontSize: '0.8em', margin: '6px 0 0 0', fontWeight: 700 }}>{ecomMesOrdenes} órdenes</p>
              </div>
              <div style={kpiBoxStyle('#06b6d4')}>
                <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, margin: '0 0 6px 0' }}>RETAIL (ODOO)</p>
                <p style={{ color: '#06b6d4', fontSize: '1.8em', fontWeight: 800, margin: 0 }}>{fmtMoney(retailMes)}</p>
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

        {/* HOY - Fila individual */}
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
            <div>
              <h3 style={{ color: '#fff', fontSize: '1.2em', fontWeight: 800, margin: 0 }}>Ventas Hoy</h3>
              <p style={{ color: '#7f8c8d', fontSize: '0.8em', margin: '4px 0 0 0' }}>E-commerce (MercadoLibre)</p>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <p style={{ fontSize: '2.2em', fontWeight: 800, margin: 0, color: '#d946ef' }}>{fmtMoney(ecomHoy)}</p>
              <p style={{ color: '#fbbf24', fontSize: '0.85em', margin: '4px 0 0 0', fontWeight: 700 }}>{ecomHoyOrdenes} órdenes</p>
            </div>
          </div>
        </div>
      </section>

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
