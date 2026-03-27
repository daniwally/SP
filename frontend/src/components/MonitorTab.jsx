import { useState, useEffect, useRef } from 'react'

const LOGO_BASE = 'https://raw.githubusercontent.com/daniwally/SP/main/logos'
const BRAND_LOGOS = {
  'SHAQ': `${LOGO_BASE}/shaq-logo.png`,
  'STARTER': `${LOGO_BASE}/starter.png`,
  'HYDRATE': `${LOGO_BASE}/hydrate-logo.png`,
  'TIMBERLAND': `${LOGO_BASE}/TBL-logo.png`,
  'URBAN_FLOW': `${LOGO_BASE}/urban-flow-logo.png`,
  'ELSYS': `${LOGO_BASE}/elsys-logo.png`,
}

const BRAND_COLORS = {
  'SHAQ': '#f59e0b',
  'STARTER': '#06b6d4',
  'HYDRATE': '#22c55e',
  'TIMBERLAND': '#a855f7',
  'URBAN_FLOW': '#ef4444',
  'ELSYS': '#ec4899',
}

const fmtMoney = (n) => Math.round(n).toLocaleString('es-AR')
const fmtTime = () => {
  const now = new Date()
  return now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
const fmtDate = () => {
  const now = new Date()
  return now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MonitorTab({ testData = {}, salesData = {} }) {
  const [clock, setClock] = useState(fmtTime())
  const [activePanel, setActivePanel] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)
  const PANEL_COUNT = 3
  const ROTATE_INTERVAL = 12000 // 12 seconds per panel

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => setClock(fmtTime()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Panel rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePanel(p => (p + 1) % PANEL_COUNT)
    }, ROTATE_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Data
  const ventasHoy = testData.hoy || {}
  const ventas7d = testData.semana || {}
  const ventasMes = testData.mes || {}

  const totalHoy = testData.totales?.hoy?.total ?? Object.values(ventasHoy).reduce((s, v) => s + (v.total || 0), 0)
  const ordenesHoy = testData.totales?.hoy?.ordenes ?? Object.values(ventasHoy).reduce((s, v) => s + (v.ordenes || 0), 0)
  const total7d = testData.totales?.semana?.total ?? Object.values(ventas7d).reduce((s, v) => s + (v.total || 0), 0)
  const ordenes7d = testData.totales?.semana?.ordenes ?? Object.values(ventas7d).reduce((s, v) => s + (v.ordenes || 0), 0)
  const totalMes = testData.totales?.mes?.total ?? Object.values(ventasMes).reduce((s, v) => s + (v.total || 0), 0)
  const ordenesMes = testData.totales?.mes?.ordenes ?? Object.values(ventasMes).reduce((s, v) => s + (v.ordenes || 0), 0)

  const brandsSemana = Object.entries(ventas7d).sort(([,a],[,b]) => (b.total||0) - (a.total||0))
  const brandsMes = Object.entries(ventasMes).sort(([,a],[,b]) => (b.total||0) - (a.total||0))
  const brandsHoy = Object.entries(ventasHoy).sort(([,a],[,b]) => (b.total||0) - (a.total||0))

  // Ticker data — all brands with today's sales
  const tickerItems = brandsHoy.map(([marca, data]) => ({
    marca,
    total: data.total || 0,
    ordenes: data.ordenes || 0,
    color: BRAND_COLORS[marca] || '#888',
  }))

  // Preguntas sin responder from salesData
  const totalPreguntas = Object.values(salesData.mes || {}).reduce((s, v) => {
    return s + (v.preguntas?.sin_responder || 0)
  }, 0)

  return (
    <div
      ref={containerRef}
      className="monitor-container"
      style={{
        background: '#0a0a0f',
        minHeight: isFullscreen ? '100vh' : 'calc(100vh - 120px)',
        padding: isFullscreen ? '30px 40px' : '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* HEADER BAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        borderBottom: '1px solid rgba(217, 70, 239, 0.3)',
        paddingBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: '#22c55e', boxShadow: '0 0 8px #22c55e',
            animation: 'monitorPulse 2s infinite',
          }} />
          <span style={{ color: '#d946ef', fontSize: isFullscreen ? '1.4em' : '1.1em', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>
            E-Commerce Live Monitor
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{ color: '#888', fontSize: isFullscreen ? '1em' : '0.85em' }}>{fmtDate()}</span>
          <span style={{
            color: '#06b6d4', fontSize: isFullscreen ? '2em' : '1.4em', fontWeight: 800,
            fontFamily: 'monospace', letterSpacing: '2px',
          }}>{clock}</span>
          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(217, 70, 239, 0.15)', border: '1px solid rgba(217, 70, 239, 0.3)',
              color: '#d946ef', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.85em', fontWeight: 600,
            }}
          >
            {isFullscreen ? 'Salir' : 'Pantalla completa'}
          </button>
        </div>
      </div>

      {/* KPI TOP ROW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '20px',
        marginBottom: '24px',
      }}>
        {/* HOY */}
        <div className="monitor-kpi-card" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
          <div className="monitor-kpi-label">Ventas Hoy</div>
          <div className="monitor-kpi-value" style={{ color: '#22c55e' }}>
            ${fmtMoney(totalHoy)}
          </div>
          <div className="monitor-kpi-sub">{ordenesHoy} órdenes</div>
        </div>

        {/* SEMANA */}
        <div className="monitor-kpi-card" style={{ borderColor: 'rgba(6, 182, 212, 0.3)' }}>
          <div className="monitor-kpi-label">Ventas Semana</div>
          <div className="monitor-kpi-value" style={{ color: '#06b6d4' }}>
            ${fmtMoney(total7d)}
          </div>
          <div className="monitor-kpi-sub">{ordenes7d} órdenes</div>
        </div>

        {/* MES */}
        <div className="monitor-kpi-card" style={{ borderColor: 'rgba(217, 70, 239, 0.3)' }}>
          <div className="monitor-kpi-label">Acumulado Mes</div>
          <div className="monitor-kpi-value" style={{ color: '#d946ef' }}>
            ${fmtMoney(totalMes)}
          </div>
          <div className="monitor-kpi-sub">{ordenesMes} órdenes</div>
        </div>
      </div>

      {/* ROTATING PANELS */}
      <div style={{ position: 'relative', minHeight: isFullscreen ? '55vh' : '45vh' }}>

        {/* PANEL 0: Ventas del día por marca */}
        <div className={`monitor-panel ${activePanel === 0 ? 'monitor-panel-active' : ''}`}>
          <h2 className="monitor-panel-title">Ventas del Día — Por Marca</h2>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(brandsHoy.length, 5)}, 1fr)`, gap: '16px' }}>
            {brandsHoy.map(([marca, data]) => {
              const maxVal = brandsHoy[0]?.[1]?.total || 1
              return (
                <div key={marca} className="monitor-brand-card">
                  <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                    {BRAND_LOGOS[marca]
                      ? <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: isFullscreen ? '44px' : '32px', objectFit: 'contain' }} />
                      : <span style={{ color: BRAND_COLORS[marca] || '#fff', fontWeight: 800, fontSize: '1.1em' }}>{marca}</span>
                    }
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: BRAND_COLORS[marca] || '#fff', fontSize: isFullscreen ? '2.2em' : '1.6em', fontWeight: 800, margin: '0 0 4px 0' }}>
                      ${fmtMoney(data.total || 0)}
                    </p>
                    <p style={{ color: '#888', fontSize: isFullscreen ? '1.1em' : '0.85em', margin: '0 0 12px 0' }}>
                      {data.ordenes || 0} órdenes
                    </p>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${((data.total || 0) / maxVal) * 100}%`,
                      height: '100%',
                      background: BRAND_COLORS[marca] || '#888',
                      borderRadius: '3px',
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  {data.productos && data.productos.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      {data.productos.slice(0, 3).map((prod, idx) => (
                        <p key={idx} style={{
                          color: '#b0b0c0', fontSize: isFullscreen ? '0.85em' : '0.75em',
                          margin: '4px 0', display: 'flex', justifyContent: 'space-between',
                        }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%', textAlign: 'left' }}>{prod.nombre}</span>
                          <span style={{ color: '#fbbf24', fontWeight: 600 }}>x{prod.cantidad}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* PANEL 1: Ventas de la semana por marca */}
        <div className={`monitor-panel ${activePanel === 1 ? 'monitor-panel-active' : ''}`}>
          <h2 className="monitor-panel-title">Ventas de la Semana — Por Marca</h2>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(brandsSemana.length, 5)}, 1fr)`, gap: '16px' }}>
            {brandsSemana.map(([marca, data]) => {
              const maxVal = brandsSemana[0]?.[1]?.total || 1
              return (
                <div key={marca} className="monitor-brand-card">
                  <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                    {BRAND_LOGOS[marca]
                      ? <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: isFullscreen ? '44px' : '32px', objectFit: 'contain' }} />
                      : <span style={{ color: BRAND_COLORS[marca] || '#fff', fontWeight: 800, fontSize: '1.1em' }}>{marca}</span>
                    }
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: BRAND_COLORS[marca] || '#fff', fontSize: isFullscreen ? '2.2em' : '1.6em', fontWeight: 800, margin: '0 0 4px 0' }}>
                      ${fmtMoney(data.total || 0)}
                    </p>
                    <p style={{ color: '#888', fontSize: isFullscreen ? '1.1em' : '0.85em', margin: '0 0 12px 0' }}>
                      {data.ordenes || 0} órdenes
                    </p>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${((data.total || 0) / maxVal) * 100}%`,
                      height: '100%',
                      background: BRAND_COLORS[marca] || '#888',
                      borderRadius: '3px',
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  {data.productos && data.productos.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      {data.productos.slice(0, 5).map((prod, idx) => (
                        <p key={idx} style={{
                          color: '#b0b0c0', fontSize: isFullscreen ? '0.85em' : '0.75em',
                          margin: '4px 0', display: 'flex', justifyContent: 'space-between',
                        }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%', textAlign: 'left' }}>{prod.nombre}</span>
                          <span style={{ color: '#fbbf24', fontWeight: 600 }}>x{prod.cantidad}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* PANEL 2: Acumulado mensual por marca */}
        <div className={`monitor-panel ${activePanel === 2 ? 'monitor-panel-active' : ''}`}>
          <h2 className="monitor-panel-title">Acumulado del Mes — Por Marca</h2>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(brandsMes.length, 5)}, 1fr)`, gap: '16px' }}>
            {brandsMes.map(([marca, data]) => {
              const maxVal = brandsMes[0]?.[1]?.total || 1
              return (
                <div key={marca} className="monitor-brand-card">
                  <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                    {BRAND_LOGOS[marca]
                      ? <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: isFullscreen ? '44px' : '32px', objectFit: 'contain' }} />
                      : <span style={{ color: BRAND_COLORS[marca] || '#fff', fontWeight: 800, fontSize: '1.1em' }}>{marca}</span>
                    }
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: BRAND_COLORS[marca] || '#fff', fontSize: isFullscreen ? '2.2em' : '1.6em', fontWeight: 800, margin: '0 0 4px 0' }}>
                      ${fmtMoney(data.total || 0)}
                    </p>
                    <p style={{ color: '#888', fontSize: isFullscreen ? '1.1em' : '0.85em', margin: '0 0 12px 0' }}>
                      {data.ordenes || 0} órdenes
                    </p>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${((data.total || 0) / maxVal) * 100}%`,
                      height: '100%',
                      background: BRAND_COLORS[marca] || '#888',
                      borderRadius: '3px',
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  {data.productos && data.productos.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      {data.productos.slice(0, 5).map((prod, idx) => (
                        <p key={idx} style={{
                          color: '#b0b0c0', fontSize: isFullscreen ? '0.85em' : '0.75em',
                          margin: '4px 0', display: 'flex', justifyContent: 'space-between',
                        }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%', textAlign: 'left' }}>{prod.nombre}</span>
                          <span style={{ color: '#fbbf24', fontWeight: 600 }}>x{prod.cantidad}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* PANEL INDICATOR DOTS */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '16px 0' }}>
        {[0, 1, 2].map(i => (
          <button
            key={i}
            onClick={() => setActivePanel(i)}
            style={{
              width: activePanel === i ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              border: 'none',
              background: activePanel === i ? '#d946ef' : 'rgba(255,255,255,0.15)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* STATUS BAR */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '32px',
        padding: '10px 0', marginBottom: '8px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {totalPreguntas > 0 && (
          <span style={{ color: '#ef4444', fontSize: isFullscreen ? '1em' : '0.85em', fontWeight: 600 }}>
            {totalPreguntas} preguntas sin responder
          </span>
        )}
        <span style={{ color: '#888', fontSize: isFullscreen ? '1em' : '0.85em' }}>
          Prom. diario: ${fmtMoney(Math.round(totalMes / Math.max(1, new Date().getDate())))}
        </span>
        <span style={{ color: '#888', fontSize: isFullscreen ? '1em' : '0.85em' }}>
          {ordenesMes} órdenes este mes
        </span>
      </div>

      {/* TICKER BAR */}
      <div className="monitor-ticker-wrap">
        <div className="monitor-ticker">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, idx) => (
            <span key={idx} className="monitor-ticker-item">
              <span style={{ color: item.color, fontWeight: 800 }}>{item.marca}</span>
              <span style={{ color: '#fff', fontWeight: 700 }}>${fmtMoney(item.total)}</span>
              <span style={{ color: '#888' }}>({item.ordenes} ord.)</span>
              <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 8px' }}>|</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
