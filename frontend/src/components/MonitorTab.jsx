import { useState, useEffect, useRef } from 'react'
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
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

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

const calcUnits = (brandData) => {
  const prods = brandData.productos || []
  return prods.reduce((s, p) => s + (p.cantidad || 0), 0)
}

export default function MonitorTab({ testData: initialTestData = {}, salesData = {} }) {
  const [clock, setClock] = useState(fmtTime())
  const [activePanel, setActivePanel] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dailyData, setDailyData] = useState(null)
  const [preguntasData, setPreguntasData] = useState(null)
  const [liveTestData, setLiveTestData] = useState(null)
  const containerRef = useRef(null)
  const PANEL_COUNT = 4
  const ROTATE_INTERVAL = 12000

  useEffect(() => {
    const interval = setInterval(() => setClock(fmtTime()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setActivePanel(p => (p + 1) % PANEL_COUNT)
    }, ROTATE_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  // Fetch all monitor data
  const fetchMonitorData = () => {
    const API = window.location.origin + '/api/test'
    axios.get(API + '/ventas-detallado', { timeout: 30000 })
      .then(res => setLiveTestData(res.data))
      .catch(() => {})
    axios.get(API + '/ventas-diarias', { timeout: 60000 })
      .then(res => setDailyData(res.data))
      .catch(() => {})
    fetch('/api/publicaciones/preguntas-sin-responder')
      .then(r => r.json())
      .then(data => setPreguntasData(data))
      .catch(() => {})
  }

  useEffect(() => {
    fetchMonitorData()
  }, [])

  // Auto-refresh every 5 min only in fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const interval = setInterval(() => {
      fetchMonitorData()
    }, 300000)
    return () => clearInterval(interval)
  }, [isFullscreen])

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

  // Data — use live data if available, otherwise props from parent
  const testData = liveTestData || initialTestData
  const ventasHoy = testData.hoy || {}
  const ventas7d = testData.semana || {}
  const ventasMes = testData.mes || {}

  const totalHoy = testData.totales?.hoy?.total ?? Object.values(ventasHoy).reduce((s, v) => s + (v.total || 0), 0)
  const ordenesHoy = testData.totales?.hoy?.ordenes ?? Object.values(ventasHoy).reduce((s, v) => s + (v.ordenes || 0), 0)
  const total7d = testData.totales?.semana?.total ?? Object.values(ventas7d).reduce((s, v) => s + (v.total || 0), 0)
  const ordenes7d = testData.totales?.semana?.ordenes ?? Object.values(ventas7d).reduce((s, v) => s + (v.ordenes || 0), 0)
  const totalMes = testData.totales?.mes?.total ?? Object.values(ventasMes).reduce((s, v) => s + (v.total || 0), 0)
  const ordenesMes = testData.totales?.mes?.ordenes ?? Object.values(ventasMes).reduce((s, v) => s + (v.ordenes || 0), 0)

  const unitsHoy = Object.values(ventasHoy).reduce((s, v) => s + calcUnits(v), 0)
  const units7d = Object.values(ventas7d).reduce((s, v) => s + calcUnits(v), 0)
  const unitsMes = Object.values(ventasMes).reduce((s, v) => s + calcUnits(v), 0)

  const brandsSemana = Object.entries(ventas7d).sort(([,a],[,b]) => (b.total||0) - (a.total||0))
  const brandsMes = Object.entries(ventasMes).sort(([,a],[,b]) => (b.total||0) - (a.total||0))
  const brandsHoy = Object.entries(ventasHoy).sort(([,a],[,b]) => (b.total||0) - (a.total||0))

  const tickerItems = brandsHoy.map(([marca, data]) => ({
    marca,
    total: data.total || 0,
    ordenes: data.ordenes || 0,
    units: calcUnits(data),
    color: BRAND_COLORS[marca] || '#888',
  }))

  const totalPreguntas = preguntasData
    ? Object.values(preguntasData).reduce((s, v) => s + (v.sin_responder || 0), 0)
    : 0

  // Render brand card helper
  const renderBrandCard = (marca, data, maxVal) => {
    const units = calcUnits(data)
    return (
      <div key={marca} className="monitor-brand-card">
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          {BRAND_LOGOS[marca]
            ? <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: isFullscreen ? '44px' : '32px', objectFit: 'contain' }} />
            : <span style={{ color: BRAND_COLORS[marca] || '#fff', fontWeight: 800, fontSize: '1.1em' }}>{marca}</span>
          }
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#fff', fontSize: isFullscreen ? '2.6em' : '1.9em', fontWeight: 800, margin: '0', lineHeight: 1.1 }}>
            {data.ordenes || 0}
          </p>
          <p style={{ color: '#888', fontSize: isFullscreen ? '0.95em' : '0.8em', margin: '2px 0 8px 0', fontWeight: 500 }}>
            productos vendidos
          </p>
          <p style={{ color: BRAND_COLORS[marca] || '#fff', fontSize: isFullscreen ? '1.3em' : '1em', fontWeight: 700, margin: '0 0 10px 0' }}>
            ${fmtMoney(data.total || 0)}
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
            {data.productos.slice(0, 10).map((prod, idx) => (
              <p key={idx} style={{
                color: '#b0b0c0', fontSize: isFullscreen ? '0.85em' : '0.75em',
                margin: '4px 0', display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '78%', textAlign: 'left' }}>{prod.nombre}</span>
                <span style={{ color: '#fbbf24', fontWeight: 600 }}>x{prod.cantidad}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="monitor-container"
      style={{
        background: isFullscreen ? '#000' : 'transparent',
        minHeight: isFullscreen ? '100vh' : 'calc(100vh - 120px)',
        padding: isFullscreen ? '30px 40px' : '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Fullscreen background image */}
      {isFullscreen && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url('https://raw.githubusercontent.com/daniwally/SP/main/backgrounds/bg1.jpg')`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.45, zIndex: 0,
        }} />
      )}
      {isFullscreen && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0))',
          zIndex: 0,
        }} />
      )}

      {/* Content wrapper */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      {/* HEADER BAR */}
      <div className="monitor-header">
        <div className="monitor-header-left">
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: '#22c55e', boxShadow: '0 0 8px #22c55e',
            animation: 'monitorPulse 2s infinite',
          }} />
          <span style={{ color: '#d946ef', fontSize: isFullscreen ? '1.4em' : '1.1em', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>
            E-Commerce Live Monitor
          </span>
        </div>

        <div className="monitor-header-right">
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
      <div className="monitor-kpi-grid" style={{ marginBottom: '24px' }}>
        {/* HOY */}
        <div className="monitor-kpi-card" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
          <div className="monitor-kpi-label">Ventas Hoy</div>
          <div className="monitor-kpi-value" style={{ color: '#22c55e' }}>
            {ordenesHoy}
          </div>
          <div className="monitor-kpi-sub" style={{ marginBottom: '4px' }}>productos vendidos</div>
          <div style={{ color: '#22c55e', fontSize: isFullscreen ? '1.3em' : '1em', fontWeight: 700, opacity: 0.85 }}>
            ${fmtMoney(totalHoy)}
          </div>
        </div>

        {/* SEMANA */}
        <div className="monitor-kpi-card" style={{ borderColor: 'rgba(6, 182, 212, 0.3)' }}>
          <div className="monitor-kpi-label">Ventas Semana</div>
          <div className="monitor-kpi-value" style={{ color: '#06b6d4' }}>
            {ordenes7d}
          </div>
          <div className="monitor-kpi-sub" style={{ marginBottom: '4px' }}>productos vendidos</div>
          <div style={{ color: '#06b6d4', fontSize: isFullscreen ? '1.3em' : '1em', fontWeight: 700, opacity: 0.85 }}>
            ${fmtMoney(total7d)}
          </div>
        </div>

        {/* MES */}
        <div className="monitor-kpi-card" style={{ borderColor: 'rgba(217, 70, 239, 0.3)' }}>
          <div className="monitor-kpi-label">Acumulado Mes</div>
          <div className="monitor-kpi-value" style={{ color: '#d946ef' }}>
            {ordenesMes}
          </div>
          <div className="monitor-kpi-sub" style={{ marginBottom: '4px' }}>productos vendidos</div>
          <div style={{ color: '#d946ef', fontSize: isFullscreen ? '1.3em' : '1em', fontWeight: 700, opacity: 0.85 }}>
            ${fmtMoney(totalMes)}
          </div>
        </div>
      </div>

      {/* ROTATING PANELS */}
      <div style={{ position: 'relative', minHeight: isFullscreen ? '55vh' : '50vh' }}>

        {/* PANEL 0: Ventas del día por marca */}
        <div className={`monitor-panel ${activePanel === 0 ? 'monitor-panel-active' : ''}`}>
          <h2 className="monitor-panel-title">Ventas del Día</h2>
          <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9em', marginTop: '-12px', marginBottom: '16px' }}>{new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: '16px' }}>
            {brandsHoy.map(([marca, data]) => renderBrandCard(marca, data, brandsHoy[0]?.[1]?.total || 1))}
          </div>
        </div>

        {/* PANEL 1: Ventas de la semana por marca */}
        <div className={`monitor-panel ${activePanel === 1 ? 'monitor-panel-active' : ''}`}>
          <h2 className="monitor-panel-title">Ventas de la Semana</h2>
          <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9em', marginTop: '-12px', marginBottom: '16px' }}>{(() => {
            const today = new Date()
            const hace7 = new Date(today)
            hace7.setDate(hace7.getDate() - 7)
            const fmt = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
            return `${fmt(hace7)} - ${fmt(today)}`
          })()}</p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: '16px' }}>
            {brandsSemana.map(([marca, data]) => renderBrandCard(marca, data, brandsSemana[0]?.[1]?.total || 1))}
          </div>
        </div>

        {/* PANEL 2: Acumulado mensual por marca */}
        <div className={`monitor-panel ${activePanel === 2 ? 'monitor-panel-active' : ''}`}>
          <h2 className="monitor-panel-title">Acumulado del Mes</h2>
          <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9em', marginTop: '-12px', marginBottom: '16px' }}>{(() => {
            const today = new Date()
            const inicio = new Date(today.getFullYear(), today.getMonth(), 1)
            const fmt = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
            return `${fmt(inicio)} - ${fmt(today)}`
          })()}</p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: '16px' }}>
            {brandsMes.map(([marca, data]) => renderBrandCard(marca, data, brandsMes[0]?.[1]?.total || 1))}
          </div>
        </div>

        {/* PANEL 3: Gráfico de variación diaria */}
        <div className={`monitor-panel ${activePanel === 3 ? 'monitor-panel-active' : ''}`}>
          <h2 className="monitor-panel-title">Variación Diaria de Ventas — Mes Actual</h2>
          <p style={{ textAlign: 'center', color: '#888', fontSize: '0.9em', marginTop: '-12px', marginBottom: '16px' }}>{(() => {
            const today = new Date()
            const inicio = new Date(today.getFullYear(), today.getMonth(), 1)
            const fmt = (d) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
            return `${fmt(inicio)} - ${fmt(today)}`
          })()}</p>
          {dailyData && dailyData.dias ? (
            <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '12px', padding: isFullscreen ? '30px' : '20px', border: '1px solid rgba(217, 70, 239, 0.2)', height: isFullscreen ? '48vh' : '38vh' }}>
              <Line
                data={{
                  labels: dailyData.dias.map(d => {
                    const parts = d.split('-')
                    return `${parts[2]}/${parts[1]}`
                  }),
                  datasets: Object.entries(dailyData.marcas || {}).map(([marca, datos]) => ({
                    label: marca,
                    data: datos.map(d => d.total),
                    ordenes: datos.map(d => d.ordenes),
                    borderColor: BRAND_COLORS[marca] || '#888',
                    backgroundColor: (BRAND_COLORS[marca] || '#888') + '15',
                    borderWidth: isFullscreen ? 3 : 2,
                    pointRadius: isFullscreen ? 4 : 3,
                    pointHoverRadius: isFullscreen ? 8 : 6,
                    tension: 0.3,
                    fill: false,
                  })),
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: { color: '#b0b0c0', usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: isFullscreen ? 14 : 12 } },
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0,0,0,0.9)',
                      titleColor: '#fff',
                      bodyColor: '#b0b0c0',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderWidth: 1,
                      titleMarginBottom: 10,
                      bodySpacing: 8,
                      padding: 14,
                      titleFont: { size: isFullscreen ? 16 : 13 },
                      bodyFont: { size: isFullscreen ? 14 : 12 },
                      callbacks: {
                        label: (ctx) => {
                          const ordenes = ctx.dataset.ordenes?.[ctx.dataIndex] || 0
                          return `${ctx.dataset.label}: $${Math.round(ctx.parsed.y).toLocaleString('es-AR')}  (${ordenes} art.)`
                        },
                        afterBody: (items) => {
                          const totalVentas = items.reduce((sum, item) => sum + (item.parsed?.y || 0), 0)
                          const totalArt = items.reduce((sum, item) => {
                            const ordenes = item.dataset.ordenes?.[item.dataIndex] || 0
                            return sum + ordenes
                          }, 0)
                          return `\nTotal del día: $${Math.round(totalVentas).toLocaleString('es-AR')}  (${totalArt} art.)`
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: { color: '#666', font: { size: isFullscreen ? 13 : 11 } },
                      grid: { color: 'rgba(255,255,255,0.04)' },
                    },
                    y: {
                      ticks: {
                        color: '#666',
                        font: { size: isFullscreen ? 13 : 11 },
                        callback: (v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`,
                      },
                      grid: { color: 'rgba(255,255,255,0.04)' },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Cargando gráfico...</p>
          )}
        </div>
      </div>

      {/* PANEL INDICATOR DOTS */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '16px 0' }}>
        {Array.from({ length: PANEL_COUNT }).map((_, i) => (
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
      <div className="monitor-status-bar">
        <span style={{ color: totalPreguntas > 0 ? '#ef4444' : '#22c55e', fontSize: isFullscreen ? '1em' : '0.85em', fontWeight: 600 }}>
          {totalPreguntas > 0 ? `${totalPreguntas} preguntas sin responder (15 días)` : 'Sin preguntas pendientes'}
        </span>
        <span style={{ color: '#888', fontSize: isFullscreen ? '1em' : '0.85em' }}>
          Prom. diario: ${fmtMoney(Math.round(totalMes / Math.max(1, new Date().getDate())))}
        </span>
        <span style={{ color: '#888', fontSize: isFullscreen ? '1em' : '0.85em' }}>
          {ordenesMes} productos vendidos este mes
        </span>
      </div>

      {/* TICKER BAR */}
      <div className="monitor-ticker-wrap">
        <div className="monitor-ticker">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, idx) => (
            <span key={idx} className="monitor-ticker-item">
              <span style={{ color: item.color, fontWeight: 800 }}>{item.marca}</span>
              <span style={{ color: '#fff', fontWeight: 700 }}>{item.ordenes} prod.</span>
              <span style={{ color: item.color, fontWeight: 600 }}>${fmtMoney(item.total)}</span>
              <span style={{ color: '#888' }}>({item.ordenes} ord.)</span>
              <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 8px' }}>|</span>
            </span>
          ))}
        </div>
      </div>
      </div>{/* close content wrapper */}
    </div>
  )
}
