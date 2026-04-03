import { useState, useEffect } from 'react'
import axios from 'axios'
import DatePicker, { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'
import 'react-datepicker/dist/react-datepicker.css'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTitle, ChartTooltip, ChartLegend)

registerLocale('es', es)
import RotatingBackground from './components/RotatingBackground'
import PublicacionesTab from './components/PublicacionesTab'
import VentasRetailTab from './components/VentasRetailTab'
import MercadoPagoTab from './components/MercadoPagoTab'
import VentasUnifiedTab from './components/VentasUnifiedTab'
import MonitorTab from './components/MonitorTab'
import EnviosHeatMap from './components/EnviosHeatMap'

const BRAND_COLORS = {
  'SHAQ': '#f59e0b',
  'STARTER': '#06b6d4',
  'HYDRATE': '#22c55e',
  'TIMBERLAND': '#a855f7',
  'URBAN_FLOW': '#ef4444',
}

const LOGO_BASE = 'https://raw.githubusercontent.com/daniwally/SP/main/logos'
const BRAND_LOGOS = {
  'SHAQ': `${LOGO_BASE}/shaq-logo.png`,
  'STARTER': `${LOGO_BASE}/starter.png`,
  'HYDRATE': `${LOGO_BASE}/hydrate-logo.png`,
  'TIMBERLAND': `${LOGO_BASE}/TBL-logo.png`,
  'ELSYS': `${LOGO_BASE}/elsys.png`,
  'URBAN_FLOW': `${LOGO_BASE}/urban-flow-logo.png`,
}
import './App.css'

// Función para formatear montos sin centavos
const fmtMoney = (n) => {
  const s = Math.round(n).toString()
  if (s.length <= 3) return s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return rest + ',' + last3
}

// Función para formatear fecha en español
const formatDateSpanish = (date) => {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const day = days[date.getDay()]
  const dayNum = date.getDate()
  const month = months[date.getMonth()]
  return `${day} ${dayNum} de ${month}`
}

// Función para obtener solo el nombre del mes actual
const getCurrentMonthName = () => {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return months[new Date().getMonth()].charAt(0).toUpperCase() + months[new Date().getMonth()].slice(1)
}

// Función para obtener hace 7 días (últimos 7 días)
const getSaturdayOfWeek = (date) => {
  const d = new Date(date)
  d.setDate(d.getDate() - 7)  // ✅ Simplemente restar 7 días
  return d
}

// Función para formatear fecha corta (DD/MM)
const formatDateShort = (date) => {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

function App() {
  const [salesData, setSalesData] = useState({})
  const [stockData, setStockData] = useState({})
  const [expandedBrand, setExpandedBrand] = useState(null)
  const [expandedWarehouses, setExpandedWarehouses] = useState({})
  const [comparadorSearch, setComparadorSearch] = useState('')
  const [comparadorSelected, setComparadorSelected] = useState([])
  const [comparadorMarca, setComparadorMarca] = useState(null)
  const [comparadorMlData, setComparadorMlData] = useState({}) // { cardKey: { loading, items: [] } }
  const [valuationData, setValuationData] = useState({})
  const [testData, setTestData] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [tokenStatus, setTokenStatus] = useState({})
  const [systemStatus, setSystemStatus] = useState(null)
  const [mlPreciosData, setMlPreciosData] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingBg, setLoadingBg] = useState(null)
  const [dateInfo, setDateInfo] = useState({ today: '', weekRange: '' })
  const [activeTab, setActiveTab] = useState('mercadolibre')
  const [rangoDesde, setRangoDesde] = useState(null)
  const [rangoHasta, setRangoHasta] = useState(null)
  const [rangoData, setRangoData] = useState(null)
  const [rangoLoading, setRangoLoading] = useState(false)
  const [enviosData, setEnviosData] = useState(null)
  const [enviosDesde, setEnviosDesde] = useState(null)
  const [enviosHasta, setEnviosHasta] = useState(null)
  const [enviosDetalle, setEnviosDetalle] = useState(null)
  const [enviosLoading, setEnviosLoading] = useState(false)
  const [enviosListaOpen, setEnviosListaOpen] = useState(false)
  const [enviosProvincia, setEnviosProvincia] = useState(null)
  const [enviosHeatmap, setEnviosHeatmap] = useState(null)
  const [enviosMarcaFilter, setEnviosMarcaFilter] = useState(null)

  useEffect(() => {
    const today = new Date()
    const saturday = getSaturdayOfWeek(today)
    
    setDateInfo({
      today: formatDateSpanish(today),
      weekRange: `${formatDateSpanish(saturday)} - ${formatDateSpanish(today)}`
    })
    
    fetchAllData()

    // Random loading background from screens/ folder
    fetch('/api/screens').then(r => r.json()).then(data => {
      if (data.screens && data.screens.length > 0) {
        setLoadingBg(data.screens[Math.floor(Math.random() * data.screens.length)])
      } else {
        setLoadingBg('/on-loading-bg.jpg')
      }
    }).catch(() => setLoadingBg('/on-loading-bg.jpg'))
  }, [])

  // Efecto: cuando cambia la selección del comparador, buscar ML matches
  useEffect(() => {
    if (comparadorSelected.length === 0 || !stockData) return
    comparadorSelected.forEach(sel => {
      const cardKey = `${sel.marca}-${sel.key}`
      if (comparadorMlData[cardKey]) return // ya cargado
      const mData = stockData[sel.marca]
      if (!mData) return
      // Recopilar todos los SKUs del producto
      const skus = new Set()
      for (const [, whData] of Object.entries(mData.almacenes || {})) {
        for (const prod of (whData.productos || [])) {
          const pKey = prod.template_id || prod.nombre
          if (String(pKey) === String(sel.key) && prod.sku) {
            skus.add(prod.sku.toUpperCase())
          }
        }
      }
      if (skus.size === 0 && !sel.name) return
      setComparadorMlData(prev => ({ ...prev, [cardKey]: { loading: true, items: [], matchType: null } }))
      const API = window.location.origin + '/api'
      axios.post(`${API}/publicaciones/match-skus`, { marca: sel.marca, skus: [...skus], product_name: sel.name }, { timeout: 30000 })
        .then(res => {
          const d = res.data || {}
          console.log(`ML [${sel.name}]: ${d.items?.length || 0} match (${d.match_type || 'none'}) de ${d.total_items_marca} items`)
          setComparadorMlData(prev => ({ ...prev, [cardKey]: { loading: false, items: d.items || [], matchType: d.match_type } }))
        })
        .catch(e => {
          console.log(`ML match error [${cardKey}]:`, e)
          setComparadorMlData(prev => ({ ...prev, [cardKey]: { loading: false, items: [] } }))
        })
    })
  }, [comparadorSelected, stockData])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      setRefreshKey(k => k + 1)
      const API = window.location.origin + '/api'
      
      console.log('🔄 Fetching data from:', API)
      
      const axiosConfig = { timeout: 30000 }
      
      const results = await Promise.allSettled([
        axios.get(API + '/ml/ventas/hoy', axiosConfig),
        axios.get(API + '/ml/ventas/7dias', axiosConfig),
        axios.get(API + '/ml/ventas/mes', axiosConfig),
        axios.get(API + '/odoo/stock/actual', axiosConfig),
        axios.get(API + '/odoo/valuacion', axiosConfig),
        axios.get(API + '/test/ventas-detallado', axiosConfig),
        axios.get(API + '/debug/all-accounts', axiosConfig),
        axios.get(API + '/publicaciones/precios-promedio', axiosConfig),
        axios.get(API + '/system-status', axiosConfig),
        axios.get(API + '/test/envios', axiosConfig)
      ])

      const ventasHoy = results[0].status === 'fulfilled' ? results[0].value.data : {}
      const ventas7dias = results[1].status === 'fulfilled' ? results[1].value.data : {}
      const ventasMes = results[2].status === 'fulfilled' ? results[2].value.data : {}
      const stockRaw = results[3].status === 'fulfilled' ? results[3].value.data : {}
      const stock = stockRaw.error ? {} : stockRaw
      const valuacionRaw = results[4].status === 'fulfilled' ? results[4].value.data : {}
      const valuacion = valuacionRaw.error ? {} : valuacionRaw
      const test = results[5].status === 'fulfilled' ? results[5].value.data : {}
      const tokens = results[6].status === 'fulfilled' ? results[6].value.data : {}
      const mlPrecios = results[7].status === 'fulfilled' ? results[7].value.data : {}
      const sysStatus = results[8].status === 'fulfilled' ? results[8].value.data : null
      const enviosResumen = results[9].status === 'fulfilled' ? results[9].value.data : null
      
      console.log('✅ Data fetched:', { ventasHoy, ventas7dias, ventasMes, stock, valuacion })
      
      setSalesData({ 
        hoy: ventasHoy, 
        dias7: ventas7dias,
        mes: ventasMes
      })
      setStockData(stock)
      const brands = ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND', 'ELSYS']
      const firstBrand = Object.entries(stock).filter(([m]) => brands.includes(m)).sort((a, b) => (b[1].total_unidades || 0) - (a[1].total_unidades || 0))[0]
      if (firstBrand) setExpandedBrand(firstBrand[0])
      setValuationData(valuacion)
      setTestData(test)
      setTokenStatus(tokens)
      setMlPreciosData(mlPrecios.precios || {})
      if (sysStatus) setSystemStatus(sysStatus)
      if (enviosResumen) setEnviosData(enviosResumen)

      setLoading(false)

      // Odoo check — runs after main data loads, doesn't block UI
      axios.get(API + '/odoo-check', { timeout: 20000 })
        .then(res => {
          setSystemStatus(prev => prev ? {
            ...prev,
            odoo: { ...prev.odoo, connected: res.data.connected, error: res.data.error }
          } : prev)
        })
        .catch(() => {})
    } catch (error) {
      console.error('❌ Error fetching data:', error)
      setLoading(false)
    }
  }

  const fmtDate = (d) => d.toISOString().slice(0, 10)

  const fetchVentasRango = async () => {
    if (!rangoDesde || !rangoHasta) return
    setRangoLoading(true)
    try {
      const API = window.location.origin + '/api'
      const resp = await axios.get(`${API}/test/ventas-rango?desde=${fmtDate(rangoDesde)}&hasta=${fmtDate(rangoHasta)}`, { timeout: 30000 })
      setRangoData(resp.data)
    } catch (e) {
      console.error('Error fetching rango:', e)
      setRangoData(null)
    }
    setRangoLoading(false)
  }

  const fetchEnviosDetalle = async () => {
    if (!enviosDesde || !enviosHasta) return
    setEnviosLoading(true)
    setEnviosProvincia(null)
    setEnviosHeatmap(null)
    setEnviosMarcaFilter(null)
    try {
      const API = window.location.origin + '/api'
      const resp = await axios.get(`${API}/test/envios-detalle?desde=${fmtDate(enviosDesde)}&hasta=${fmtDate(enviosHasta)}`, { timeout: 60000 })
      setEnviosDetalle(resp.data)
      setEnviosLoading(false)
      // Heatmap: agregar localidades del resultado y mandar a geocodificar
      const locs = {}
      ;(resp.data.envios || []).forEach(e => {
        if (e.ciudad && e.provincia) {
          const k = `${e.ciudad}|${e.provincia}`
          if (!locs[k]) locs[k] = { ciudad: e.ciudad, provincia: e.provincia, cantidad: 0 }
          locs[k].cantidad += 1
        }
      })
      const topLocs = Object.values(locs).sort((a, b) => b.cantidad - a.cantidad).slice(0, 50)
      if (topLocs.length > 0) {
        axios.post(`${API}/test/geocode-localidades`, { localidades: topLocs }, { timeout: 120000 })
          .then(r => setEnviosHeatmap(r.data.heatmap || []))
          .catch(() => setEnviosHeatmap([]))
      } else {
        setEnviosHeatmap([])
      }
    } catch (e) {
      console.error('Error fetching envios detalle:', e)
      setEnviosDetalle(null)
      setEnviosLoading(false)
    }
  }

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

  // 💾 Usar testData (/test/ventas-detallado) en lugar de ml/ventas/* endpoints
  const ventasHoy = testData.hoy || {}
  const ventas7d = testData.semana || {}
  const ventasMes = testData.mes || {}
  // salesData.mes tiene preguntas, alertas, recomendaciones (de /ml/ventas/mes)
  const ventasMesMl = salesData.mes || {}
  
  // Calcular totales - usar totales pre-calculados del backend, con fallback a suma manual
  const totalHoy = testData.totales?.hoy?.total ?? Object.values(ventasHoy).reduce((sum, v) => sum + (v.total || 0), 0)
  const ordenesHoy = testData.totales?.hoy?.ordenes ?? Object.values(ventasHoy).reduce((sum, v) => sum + (v.ordenes || 0), 0)
  const total7d = testData.totales?.semana?.total ?? Object.values(ventas7d).reduce((sum, v) => sum + (v.total || 0), 0)
  const ordenes7d = testData.totales?.semana?.ordenes ?? Object.values(ventas7d).reduce((sum, v) => sum + (v.ordenes || 0), 0)
  const totalMensual = testData.totales?.mes?.total ?? Object.values(ventasMes).reduce((sum, v) => sum + (v.total || 0), 0)
  const ordenesMes = testData.totales?.mes?.ordenes ?? Object.values(ventasMes).reduce((sum, v) => sum + (v.ordenes || 0), 0)
  const unidadesMes = Object.values(ventasMes).reduce((sum, v) => {
    const prods = v.productos || []
    return sum + prods.reduce((s, p) => s + (p.cantidad || 0), 0)
  }, 0)
  
  // Top 3 marcas del mes
  const marcasOrdenadas = Object.entries(ventasMes)
    .sort(([, a], [, b]) => (b.total || 0) - (a.total || 0))
    .slice(0, 3)

  return (
    <>
      <RotatingBackground />
      <div className="app">
        <header className="header">
        <h1 className="brand-logo" onClick={() => setActiveTab('mercadolibre')} style={{ cursor: 'pointer' }}><span className="brand-command">ONEMANDO</span><span className="brand-dot">.</span><span className="brand-ai">ai</span></h1>
        <div className="header-actions">
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === 'mercadolibre' ? 'active' : ''}`}
              onClick={() => setActiveTab('mercadolibre')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              e-comm
            </button>
            <button
              className={`tab-btn ${activeTab === 'retail' ? 'active' : ''}`}
              onClick={() => setActiveTab('retail')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Retail
            </button>
            <button
              className={`tab-btn ${activeTab === 'mercadopago' ? 'active' : ''}`}
              onClick={() => setActiveTab('mercadopago')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              MP
            </button>
            <button
              className={`tab-btn ${activeTab === 'ventas' ? 'active' : ''}`}
              onClick={() => setActiveTab('ventas')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Ventas
            </button>
            <button
              className={`tab-btn ${activeTab === 'publicaciones' ? 'active' : ''}`}
              onClick={() => setActiveTab('publicaciones')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Publicaciones
            </button>
            <button
              className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
              onClick={() => setActiveTab('stock')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              Stock
            </button>
            <button
              className={`tab-btn ${activeTab === 'envios' ? 'active' : ''}`}
              onClick={() => setActiveTab('envios')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              Envíos
            </button>
            <button
              className={`tab-btn tab-monitor ${activeTab === 'monitor' ? 'active' : ''}`}
              onClick={() => setActiveTab('monitor')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              TV Monitor
            </button>
          </div>
          <button onClick={fetchAllData} className="btn-refresh">↻</button>
        </div>
      </header>

      <main className="dashboard">
        {activeTab === 'mercadolibre' && (
        <>
        {/* VENTAS DEL DÍA */}
        <div className="stacked-sections">
          <section className="section">
            <h2>Ventas del Día</h2>
            <p className="section-date">{dateInfo.today}</p>
            <div className="cards-grid">
              {Object.entries(ventasHoy).map(([marca, data]) => (
                <div key={marca} className="card">
                  {BRAND_LOGOS[marca] ? (
                    <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '8px' }} />
                  ) : (
                    <h3>{marca}</h3>
                  )}
                  <div style={{ textAlign: 'center', margin: '8px 0 4px 0' }}>
                    <p className="total-item-ordenes" style={{ fontSize: '2.21em', margin: 0 }}>{data.ordenes || 0}</p>
                    <p className="total-item-ordenes" style={{ fontSize: '0.85em', margin: '0 0 4px 0' }}>ventas</p>
                  </div>
                  <p className="value" style={{ fontSize: '0.68em' }}>${fmtMoney(data.total || 0)}</p>
                  {data.productos && data.productos.length > 0 && (
                    <div className="productos-list">
                      {data.productos.slice(0, 10).map((prod, idx) => (
                        <p key={idx} className="producto-item">
                          {prod.nombre} <span className="cantidad">x{prod.cantidad}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* TOTALES EN LÍNEA - entre día y semana */}
          <div className="totals-row totals-row-small">
            <div className="total-item">
              <span className="total-item-label">Hoy</span>
              <span className="total-item-ordenes">{ordenesHoy} ventas</span>
              <span className="total-item-value">${fmtMoney(totalHoy)}</span>
            </div>
            <div className="total-item">
              <span className="total-item-label">Semana</span>
              <span className="total-item-ordenes">{ordenes7d} ventas</span>
              <span className="total-item-value">${fmtMoney(total7d)}</span>
            </div>
          </div>

          {/* VENTAS DE LA SEMANA */}
          <section className="section">
            <h2>Ventas de la Semana</h2>
            <p className="section-date">{dateInfo.weekRange}</p>
            <div className="cards-grid">
              {Object.entries(ventas7d).map(([marca, data]) => (
                <div key={marca} className="card">
                  {BRAND_LOGOS[marca] ? (
                    <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '8px' }} />
                  ) : (
                    <h3>{marca}</h3>
                  )}
                  <div style={{ textAlign: 'center', margin: '8px 0 4px 0' }}>
                    <p className="total-item-ordenes" style={{ fontSize: '2.21em', margin: 0 }}>{data.ordenes || 0}</p>
                    <p className="total-item-ordenes" style={{ fontSize: '0.85em', margin: '0 0 4px 0' }}>ventas</p>
                  </div>
                  <p className="value" style={{ fontSize: '0.68em' }}>${fmtMoney(data.total || 0)}</p>
                  {data.productos && data.productos.length > 0 && (
                    <div className="productos-list">
                      {data.productos.slice(0, 10).map((prod, idx) => (
                        <p key={idx} className="producto-item">
                          {prod.nombre} <span className="cantidad">x{prod.cantidad}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* COMPARATIVA */}
        <section className="section">
          <h2>Acumulado Mensual</h2>
          <p className="section-date">
            {(() => {
              const today = new Date()
              const inicio = new Date(today.getFullYear(), today.getMonth(), 1)
              return `${formatDateSpanish(inicio)} - ${formatDateSpanish(today)}`
            })()}
          </p>
          <div className="acumulado-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
            <div className="compare-card">
              <p className="big-number">${(totalMensual / 1000000).toFixed(2)}M</p>
              <p className="subtitle">Acumulado de {getCurrentMonthName()}</p>
            </div>

            <div className="compare-card">
              <p className="big-number">${fmtMoney(Math.round(totalMensual / new Date().getDate()))}</p>
              <p className="subtitle">Promedio diario del mes</p>
            </div>

            <div className="compare-card">
              <p className="big-number">{ordenesMes.toLocaleString('es-AR')}</p>
              <p className="subtitle">Ventas</p>
            </div>

            <div className="compare-card">
              <p className="big-number">{Math.round(ordenesMes / new Date().getDate()).toLocaleString('es-AR')}</p>
              <p className="subtitle">Promedio prod/día</p>
            </div>
          </div>
        </section>

        {/* CONSULTA POR RANGO DE FECHAS */}
        <section className="section">
          <h2>Consulta por Rango</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <DatePicker
              selected={rangoDesde}
              onChange={date => setRangoDesde(date)}
              selectsStart
              startDate={rangoDesde}
              endDate={rangoHasta}
              maxDate={new Date()}
              locale="es"
              dateFormat="dd/MM/yyyy"
              placeholderText="Desde"
              className="rango-datepicker"
            />
            <span style={{ color: '#7f8c8d' }}>a</span>
            <DatePicker
              selected={rangoHasta}
              onChange={date => setRangoHasta(date)}
              selectsEnd
              startDate={rangoDesde}
              endDate={rangoHasta}
              minDate={rangoDesde}
              maxDate={new Date()}
              locale="es"
              dateFormat="dd/MM/yyyy"
              placeholderText="Hasta"
              className="rango-datepicker"
            />
            <button onClick={fetchVentasRango} disabled={rangoLoading || !rangoDesde || !rangoHasta}
              style={{ padding: '8px 20px', borderRadius: '20px', border: '1px solid rgba(6, 182, 212, 0.5)', background: rangoLoading ? '#555' : 'rgba(6, 182, 212, 0.2)', color: '#06b6d4', fontWeight: 600, cursor: 'pointer', fontSize: '0.9em' }}>
              {rangoLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {rangoData && (
            <>
              <div className="totals-row totals-row-small" style={{ marginBottom: '16px' }}>
                <div className="total-item">
                  <span>Total Rango:</span>
                  <span className="total-item-ordenes">{rangoData.totales?.ordenes || 0} ventas</span>
                  <span className="total-item-value" style={{ fontSize: '1.53em' }}>${fmtMoney(rangoData.totales?.total || 0)}</span>
                </div>
                <div className="total-item">
                  <span>Prom. diario:</span>
                  <span className="total-item-ordenes">{Math.round((rangoData.totales?.ordenes || 0) / Math.max(1, Math.ceil((rangoHasta - rangoDesde) / 86400000) + 1))} ventas</span>
                  <span className="total-item-value" style={{ fontSize: '1.53em' }}>${fmtMoney(Math.round((rangoData.totales?.total || 0) / Math.max(1, Math.ceil((rangoHasta - rangoDesde) / 86400000) + 1)))}</span>
                </div>
              </div>
              <div className="cards-grid">
                {Object.entries(rangoData).filter(([k]) => k !== 'totales' && k !== 'diario' && k !== 'categorias').map(([marca, data]) => (
                  <div key={marca} className="card">
                    {BRAND_LOGOS[marca] ? (
                      <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '8px' }} />
                    ) : (
                      <h3>{marca}</h3>
                    )}
                    <div style={{ textAlign: 'center', margin: '8px 0 4px 0' }}>
                      <p className="total-item-ordenes" style={{ fontSize: '2.21em', margin: 0 }}>{data.ordenes || 0}</p>
                      <p className="total-item-ordenes" style={{ fontSize: '0.85em', margin: '0 0 4px 0' }}>ventas</p>
                    </div>
                    <p className="value" style={{ fontSize: '0.68em' }}>${fmtMoney(data.total || 0)}</p>
                    {data.productos && data.productos.length > 0 && (
                      <div className="productos-list">
                        {data.productos.slice(0, 10).map((prod, idx) => (
                          <p key={idx} className="producto-item">
                            {prod.nombre} <span className="cantidad">x{prod.cantidad}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* GRÁFICO DE VARIACIÓN DIARIA */}
              {rangoData.diario && rangoData.diario.dias && rangoData.diario.dias.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '20px' }}>
                  <h3 style={{ color: '#fff', fontSize: '1em', fontWeight: 600, margin: '0 0 12px 0' }}>Variación Diaria de Ventas</h3>
                  <Line
                    data={{
                      labels: rangoData.diario.dias.map(d => {
                        const parts = d.split('-')
                        return `${parts[2]}/${parts[1]}`
                      }),
                      datasets: Object.entries(rangoData.diario.marcas || {}).map(([marca, datos]) => ({
                        label: marca,
                        data: datos.map(d => d.total),
                        ordenes: datos.map(d => d.ordenes),
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
                          backgroundColor: 'rgba(0,0,0,0.9)',
                          titleColor: '#fff',
                          bodyColor: '#b0b0c0',
                          borderColor: 'rgba(255,255,255,0.1)',
                          borderWidth: 1,
                          titleMarginBottom: 10,
                          bodySpacing: 8,
                          padding: 14,
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
              )}

            </>
          )}
        </section>

        </>
        )}

        {activeTab === 'stock' && (
        <>
        {/* STOCK POR MARCA - Estilo e-commerce */}
        <div className="stacked-sections">
          <section className="section">
            <h2>Stock por Marca</h2>
            <p className="section-date">{dateInfo.today}</p>
            <div className="cards-grid">
              {Object.entries(stockData)
                .filter(([marca]) => ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND', 'ELSYS'].includes(marca))
                .sort((a, b) => (b[1].total_unidades || 0) - (a[1].total_unidades || 0))
                .map(([marca, data]) => {
                  const artilleros = data.almacenes?.['Artilleros']?.total || 0
                  const aduana = data.almacenes?.['Aduana (Tránsito – Solo interno)']?.total || 0

                  return (
                    <div key={marca} className="card">
                      {BRAND_LOGOS[marca] ? (
                        <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '8px' }} />
                      ) : (
                        <h3>{marca}</h3>
                      )}
                      <div style={{ textAlign: 'center', margin: '8px 0 12px 0' }}>
                        <p className="total-item-ordenes" style={{ fontSize: '2.21em', margin: 0 }}>{(data.total_unidades || 0).toLocaleString('es-AR')}</p>
                        <p className="total-item-ordenes" style={{ fontSize: '0.85em', margin: '0 0 4px 0' }}>unidades</p>
                      </div>
                      <br />
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1, textAlign: 'center', background: 'rgba(6, 182, 212, 0.08)', borderRadius: '8px', padding: '10px 6px' }}>
                          <p style={{ color: '#7f8c8d', fontSize: '0.7em', fontWeight: 600, margin: '0 0 4px 0' }}>Artilleros</p>
                          <p style={{ color: '#06b6d4', fontSize: '1.5em', fontWeight: 700, margin: 0 }}>{artilleros.toLocaleString('es-AR')}</p>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', background: 'rgba(62, 127, 255, 0.08)', borderRadius: '8px', padding: '10px 6px' }}>
                          <p style={{ color: '#7f8c8d', fontSize: '0.7em', fontWeight: 600, margin: '0 0 4px 0' }}>Aduana</p>
                          <p style={{ color: '#3e7fff', fontSize: '1.5em', fontWeight: 700, margin: 0 }}>{aduana.toLocaleString('es-AR')}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>

          {/* TOTAL STOCK CARD */}
          {(() => {
            const totalStock = Object.values(stockData).reduce((sum, m) => sum + (m.total_unidades || 0), 0)
            const totalArt = Object.values(stockData).reduce((sum, m) => sum + (m.almacenes?.['Artilleros']?.total || 0), 0)
            const totalAdu = Object.values(stockData).reduce((sum, m) => sum + (m.almacenes?.['Aduana (Tránsito – Solo interno)']?.total || 0), 0)
            const marcasStock = Object.entries(stockData)
              .filter(([marca]) => ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND', 'ELSYS'].includes(marca))
              .map(([marca, data]) => ({ marca, total: data.total_unidades || 0 }))
              .sort((a, b) => b.total - a.total)
            const maxStock = marcasStock[0]?.total || 1

            return (
              <div className="cards-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="card" style={{ maxWidth: '50%' }}>
                  <div style={{ textAlign: 'center', margin: '4px 0 14px 0' }}>
                    <p style={{ fontSize: '2.8em', fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #d946ef, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{totalStock.toLocaleString('es-AR')}</p>
                    <p className="total-item-ordenes" style={{ fontSize: '0.9em', margin: '0 0 4px 0' }}>unidades — Total Stock</p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', maxWidth: '400px', margin: '0 auto 20px auto' }}>
                    <div style={{ flex: 1, textAlign: 'center', background: 'rgba(6, 182, 212, 0.08)', borderRadius: '8px', padding: '10px 6px' }}>
                      <p style={{ color: '#7f8c8d', fontSize: '0.7em', fontWeight: 600, margin: '0 0 4px 0' }}>Artilleros</p>
                      <p style={{ color: '#06b6d4', fontSize: '1.5em', fontWeight: 700, margin: 0 }}>{totalArt.toLocaleString('es-AR')}</p>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', background: 'rgba(62, 127, 255, 0.08)', borderRadius: '8px', padding: '10px 6px' }}>
                      <p style={{ color: '#7f8c8d', fontSize: '0.7em', fontWeight: 600, margin: '0 0 4px 0' }}>Aduana</p>
                      <p style={{ color: '#3e7fff', fontSize: '1.5em', fontWeight: 700, margin: 0 }}>{totalAdu.toLocaleString('es-AR')}</p>
                    </div>
                  </div>

                  {/* Top Marcas por Stock */}
                  <div className="retail-top-productos" style={{ maxWidth: '100%', margin: 0, background: 'transparent', border: 'none', padding: '0' }}>
                    <h3 style={{ fontSize: '0.9em' }}>Distribución por Marca</h3>
                    {marcasStock.map((m, i) => {
                      const logo = BRAND_LOGOS[m.marca]
                      const pct = totalStock > 0 ? ((m.total / totalStock) * 100).toFixed(1) : '0.0'
                      return (
                        <div key={i} className="top-prod-item">
                          <span className="top-prod-rank">#{i + 1}</span>
                          {logo ? (
                            <img src={logo} alt={m.marca} className="top-marca-logo" />
                          ) : (
                            <span className="top-prod-name" title={m.marca}>{m.marca}</span>
                          )}
                          <div className="top-prod-bar">
                            <div className="top-prod-bar-fill" style={{ width: `${(m.total / maxStock) * 100}%` }} />
                          </div>
                          <span className="top-prod-amount">{m.total.toLocaleString('es-AR')}</span>
                          <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.85em', minWidth: '50px', textAlign: 'right' }}>{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* SELECTOR DE MARCA - DETALLE STOCK */}
        <section className="section">
          <h2>Detalle Stock por Marca</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {Object.entries(stockData)
              .filter(([marca]) => ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND', 'ELSYS'].includes(marca))
              .sort((a, b) => (b[1].total_unidades || 0) - (a[1].total_unidades || 0))
              .map(([marca]) => {
                const isActive = expandedBrand === marca
                return (
                  <div
                    key={marca}
                    onClick={() => { setExpandedBrand(isActive ? null : marca); setExpandedWarehouses({}) }}
                    style={{
                      cursor: 'pointer',
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: isActive ? '2px solid #d946ef' : '1px solid rgba(255,255,255,0.1)',
                      background: isActive ? 'rgba(217, 70, 239, 0.12)' : 'rgba(0,0,0,0.4)',
                      transition: 'all 0.2s',
                      opacity: expandedBrand && !isActive ? 0.5 : 1,
                    }}
                  >
                    {BRAND_LOGOS[marca] ? (
                      <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '28px', maxWidth: '110px', objectFit: 'contain', display: 'block' }} />
                    ) : (
                      <span style={{ color: '#fff', fontWeight: 700 }}>{marca}</span>
                    )}
                  </div>
                )
              })}
          </div>

          {expandedBrand && stockData[expandedBrand] && (() => {
            const data = stockData[expandedBrand]
            const almacenes = data.almacenes || {}
            return (
              <div className="card" style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  {BRAND_LOGOS[expandedBrand] ? (
                    <img src={BRAND_LOGOS[expandedBrand]} alt={expandedBrand} style={{ height: '32px', maxWidth: '140px', objectFit: 'contain' }} />
                  ) : (
                    <h3 style={{ margin: 0 }}>{expandedBrand}</h3>
                  )}
                  <span style={{ color: '#d946ef', fontWeight: 700, fontSize: '1.2em' }}>{(data.total_unidades || 0).toLocaleString('es-AR')} unidades</span>
                </div>
                {Object.entries(almacenes).map(([whName, whData]) => {
                  const whKey = `${expandedBrand}-${whName}`
                  const isOpen = !!expandedWarehouses[whKey]
                  const whColor = whName.includes('Aduana') ? '#3e7fff' : '#06b6d4'
                  return (
                    <div key={whName} style={{ marginBottom: '4px' }}>
                      <div
                        onClick={() => setExpandedWarehouses(prev => ({ ...prev, [whKey]: !prev[whKey] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', background: isOpen ? 'rgba(217, 70, 239, 0.06)' : 'transparent', transition: 'background 0.2s' }}
                      >
                        <span className={`expand-icon${isOpen ? ' open' : ''}`}>&#9654;</span>
                        <span style={{ color: whColor, fontWeight: 700, fontSize: '0.95em' }}>{whName}</span>
                        <span style={{ color: '#888', fontSize: '0.85em' }}>{(whData.total || 0).toLocaleString('es-AR')} unidades</span>
                        <span style={{ color: '#666', fontSize: '0.8em' }}>({(whData.productos || []).length} productos)</span>
                      </div>
                      {isOpen && (() => {
                        // Agrupar productos por template (tipo de producto)
                        const groups = {}
                        for (const prod of (whData.productos || [])) {
                          const key = prod.template_id || prod.nombre
                          if (!groups[key]) {
                            groups[key] = { name: prod.template_name || prod.nombre, total: 0, colores: new Set(), talles: new Set(), productos: [], imagen: prod.imagen }
                          }
                          groups[key].total += prod.cantidad
                          groups[key].productos.push(prod)
                          if (!groups[key].imagen && prod.imagen) groups[key].imagen = prod.imagen
                          const a = prod.atributos || {}
                          const c = a['Color'] || a['color'] || ''
                          const t = a['Talle'] || a['talle'] || a['Size'] || a['Tamaño'] || ''
                          if (c) groups[key].colores.add(c)
                          if (t) groups[key].talles.add(t)
                        }
                        const sorted = Object.entries(groups).sort((a, b) => b[1].total - a[1].total)
                        return (
                          <div style={{ padding: '4px 0 8px 0' }}>
                            {sorted.map(([gKey, g], gIdx) => {
                              const gExpandKey = `${whKey}-${gKey}`
                              const gOpen = !!expandedWarehouses[gExpandKey]
                              return (
                                <div key={gKey} style={{ marginBottom: '2px' }}>
                                  <div
                                    onClick={() => setExpandedWarehouses(prev => ({ ...prev, [gExpandKey]: !prev[gExpandKey] }))}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', background: gOpen ? 'rgba(217, 70, 239, 0.04)' : 'transparent', transition: 'background 0.15s', flexWrap: 'wrap' }}
                                  >
                                    <span className={`expand-icon${gOpen ? ' open' : ''}`} style={{ fontSize: '0.55em', marginTop: '4px' }}>&#9654;</span>
                                    <span
                                      style={{ fontWeight: 600, fontSize: '0.88em', marginRight: '4px', position: 'relative' }}
                                      onMouseEnter={(e) => { const tip = e.currentTarget.querySelector('.stock-thumb'); if (tip) tip.style.display = 'block' }}
                                      onMouseLeave={(e) => { const tip = e.currentTarget.querySelector('.stock-thumb'); if (tip) tip.style.display = 'none' }}
                                    >
                                      {g.name}
                                      {g.imagen && (
                                        <div className="stock-thumb" style={{ display: 'none', position: 'absolute', left: '0', ...(gIdx < 2 ? { top: '30px' } : { top: '-85px' }), zIndex: 20, background: '#1a1a2e', border: '1px solid rgba(217, 70, 239, 0.3)', borderRadius: '8px', padding: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                          <img src={`data:image/png;base64,${g.imagen}`} alt="" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '6px' }} />
                                        </div>
                                      )}
                                    </span>
                                    <span style={{ fontWeight: 700, fontSize: '0.88em', marginRight: '6px' }}>{g.total.toLocaleString('es-AR')}</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                      {[...g.colores].map(c => (
                                        <span key={c} style={{ background: 'rgba(217, 70, 239, 0.12)', color: '#d946ef', padding: '1px 7px', borderRadius: '4px', fontSize: '0.78em', fontWeight: 600 }}>{c}</span>
                                      ))}
                                      {[...g.talles].map(t => (
                                        <span key={t} style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', padding: '1px 7px', borderRadius: '4px', fontSize: '0.78em', fontWeight: 600 }}>{t}</span>
                                      ))}
                                    </div>
                                  </div>
                                  {gOpen && (
                                    <table className="retail-table" style={{ fontSize: '0.78em', margin: '0 0 4px 28px', width: 'calc(100% - 28px)' }}>
                                      <thead>
                                        <tr>
                                          <th style={{ textAlign: 'right' }}>Cant.</th>
                                          <th>SKU</th>
                                          <th>Producto</th>
                                          <th>Color</th>
                                          <th>Talle</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {g.productos.sort((a, b) => b.cantidad - a.cantidad).map((prod, idx) => {
                                          const pa = prod.atributos || {}
                                          const pc = pa['Color'] || pa['color'] || ''
                                          const pt = pa['Talle'] || pa['talle'] || pa['Size'] || pa['Tamaño'] || ''
                                          return (
                                            <tr key={idx}>
                                              <td style={{ textAlign: 'right', fontWeight: 600, minWidth: '50px' }}>{prod.cantidad.toLocaleString('es-AR')}</td>
                                              <td style={{ color: '#888' }}>{prod.sku || '—'}</td>
                                              <td
                                                style={{ whiteSpace: 'normal', position: 'relative' }}
                                                onMouseEnter={(e) => { const tip = e.currentTarget.querySelector('.stock-thumb-row'); if (tip) tip.style.display = 'block' }}
                                                onMouseLeave={(e) => { const tip = e.currentTarget.querySelector('.stock-thumb-row'); if (tip) tip.style.display = 'none' }}
                                              >
                                                {prod.nombre}
                                                {prod.imagen && (
                                                  <div className="stock-thumb-row" style={{ display: 'none', position: 'absolute', left: '0', ...(idx < 2 ? { top: '25px' } : { top: '-80px' }), zIndex: 20, background: '#1a1a2e', border: '1px solid rgba(217, 70, 239, 0.3)', borderRadius: '8px', padding: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                                    <img src={`data:image/png;base64,${prod.imagen}`} alt="" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '6px' }} />
                                                  </div>
                                                )}
                                              </td>
                                              <td>{pc && <span style={{ background: 'rgba(217, 70, 239, 0.12)', color: '#d946ef', padding: '1px 6px', borderRadius: '4px', fontSize: '0.9em', fontWeight: 600 }}>{pc}</span>}</td>
                                              <td>{pt && <span style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', padding: '1px 6px', borderRadius: '4px', fontSize: '0.9em', fontWeight: 600 }}>{pt}</span>}</td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </section>

        {/* COMPARADOR DE STOCKS */}
        <section className="section">
          <h2>Comparador de Stock</h2>
          <p style={{ color: '#888', fontSize: '0.85em', margin: '-4px 0 16px 0' }}>Artilleros vs Aduana — Seleccioná marca y producto para comparar</p>

          {/* Paso 1: Selector de marca con logos */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {Object.entries(stockData)
              .filter(([marca]) => ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND', 'ELSYS'].includes(marca))
              .sort((a, b) => (b[1].total_unidades || 0) - (a[1].total_unidades || 0))
              .map(([marca]) => {
                const isActive = comparadorMarca === marca
                return (
                  <div
                    key={marca}
                    onClick={() => { setComparadorMarca(isActive ? null : marca); setComparadorSearch('') }}
                    style={{
                      cursor: 'pointer', padding: '10px 18px', borderRadius: '10px',
                      border: isActive ? '2px solid #d946ef' : '1px solid rgba(255,255,255,0.1)',
                      background: isActive ? 'rgba(217, 70, 239, 0.12)' : 'rgba(0,0,0,0.4)',
                      transition: 'all 0.2s',
                      opacity: comparadorMarca && !isActive ? 0.4 : 1,
                    }}
                  >
                    {BRAND_LOGOS[marca] ? (
                      <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '28px', maxWidth: '110px', objectFit: 'contain', display: 'block' }} />
                    ) : (
                      <span style={{ color: '#fff', fontWeight: 700 }}>{marca}</span>
                    )}
                  </div>
                )
              })}
          </div>

          {/* Paso 2: Lista de productos de la marca seleccionada */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          {comparadorMarca && stockData[comparadorMarca] && (() => {
            const mData = stockData[comparadorMarca]
            // Agrupar por template
            const groups = {}
            for (const [, whData] of Object.entries(mData.almacenes || {})) {
              for (const prod of (whData.productos || [])) {
                const key = prod.template_id || prod.nombre
                if (!groups[key]) {
                  groups[key] = { name: prod.template_name || prod.nombre, sku: prod.sku, imagen: prod.imagen, total: 0 }
                }
                groups[key].total += prod.cantidad
                if (!groups[key].imagen && prod.imagen) groups[key].imagen = prod.imagen
              }
            }
            const sorted = Object.entries(groups).sort((a, b) => b[1].total - a[1].total)
            const filtered = comparadorSearch
              ? sorted.filter(([, g]) => g.name.toLowerCase().includes(comparadorSearch.toLowerCase()) || (g.sku || '').toLowerCase().includes(comparadorSearch.toLowerCase()))
              : sorted

            return (
              <div style={{ width: '50%', minWidth: 0 }}>
                <input
                  type="text"
                  value={comparadorSearch}
                  onChange={(e) => setComparadorSearch(e.target.value)}
                  placeholder={`Filtrar productos de ${comparadorMarca}...`}
                  style={{ width: '100%', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '0.85em', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
                />
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', background: 'rgba(0,0,0,0.3)' }}>
                  {filtered.map(([gKey, g], fIdx) => {
                    const alreadySelected = comparadorSelected.some(s => String(s.key) === String(gKey) && s.marca === comparadorMarca)
                    return (
                      <div
                        key={gKey}
                        onClick={() => {
                          if (!alreadySelected) {
                            setComparadorSelected(prev => [...prev, { key: gKey, marca: comparadorMarca, name: g.name, sku: g.sku, imagen: g.imagen }])
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', cursor: alreadySelected ? 'default' : 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: alreadySelected ? 0.35 : 1, transition: 'background 0.15s' }}
                        onMouseEnter={(e) => { if (!alreadySelected) e.currentTarget.style.background = 'rgba(217, 70, 239, 0.08)'; const tip = e.currentTarget.querySelector('.cmp-thumb'); if (tip) tip.style.display = 'block' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; const tip = e.currentTarget.querySelector('.cmp-thumb'); if (tip) tip.style.display = 'none' }}
                      >
                        <span style={{ color: '#d946ef', fontWeight: 700, fontSize: '0.85em', minWidth: '55px', textAlign: 'right' }}>{g.total.toLocaleString('es-AR')}</span>
                        <span style={{ fontSize: '0.88em', flex: 1, position: 'relative' }}>
                          {g.name}
                          {g.imagen && (
                            <div className="cmp-thumb" style={{ display: 'none', position: 'absolute', left: '0', ...(fIdx < 2 ? { top: '25px' } : { top: '-85px' }), zIndex: 20, background: '#1a1a2e', border: '1px solid rgba(217, 70, 239, 0.3)', borderRadius: '8px', padding: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                              <img src={`data:image/png;base64,${g.imagen}`} alt="" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '6px' }} />
                            </div>
                          )}
                        </span>
                        {g.sku && <span style={{ color: '#666', fontSize: '0.75em' }}>{g.sku}</span>}
                        {alreadySelected && <span style={{ color: '#22c55e', fontSize: '0.8em', fontWeight: 600 }}>&#10003;</span>}
                      </div>
                    )
                  })}
                  {filtered.length === 0 && <p style={{ color: '#666', padding: '14px', textAlign: 'center', fontSize: '0.85em' }}>Sin resultados</p>}
                </div>
              </div>
            )
          })()}

          {/* Resultados de comparación */}
          {comparadorSelected.length > 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
              {comparadorSelected.map((sel, idx) => {
                const mData = stockData[sel.marca]
                if (!mData) return null
                let artTotal = 0, aduTotal = 0
                const skus = new Set()
                for (const [whName, whData] of Object.entries(mData.almacenes || {})) {
                  for (const prod of (whData.productos || [])) {
                    const pKey = prod.template_id || prod.nombre
                    if (String(pKey) === String(sel.key)) {
                      if (whName.includes('Aduana')) aduTotal += prod.cantidad
                      else artTotal += prod.cantidad
                      if (prod.sku) skus.add(prod.sku.toUpperCase())
                    }
                  }
                }

                // ML: datos del match (cargados via useEffect)
                const cardKey = `${sel.marca}-${sel.key}`
                const mlInfo = comparadorMlData[cardKey] || { loading: false, items: [] }
                const mlItems = mlInfo.items || []
                const mlTotal = mlItems.reduce((s, p) => s + (p.stock || 0), 0)

                const total = artTotal + aduTotal + mlTotal
                const maxBar = Math.max(artTotal, aduTotal, mlTotal) || 1

                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                      <button
                        onClick={() => setComparadorSelected(prev => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', cursor: 'pointer', fontSize: '0.85em', padding: '2px 8px', borderRadius: '6px' }}
                      >&times;</button>
                    </div>
                    <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      {BRAND_LOGOS[sel.marca] && <img src={BRAND_LOGOS[sel.marca]} alt="" style={{ height: '22px', objectFit: 'contain' }} />}
                      <span style={{ fontWeight: 700, fontSize: '0.95em' }}>{sel.name}</span>
                      {sel.sku
                        ? <span style={{ color: '#888', fontSize: '0.8em' }}>{sel.sku}</span>
                        : <span style={{ color: '#ef4444', fontSize: '0.75em', fontStyle: 'italic' }}>* producto sin SKU</span>}
                      <span style={{ color: '#d946ef', fontWeight: 700, marginLeft: 'auto' }}>{total.toLocaleString('es-AR')} total</span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                      {/* Aduana */}
                      <div style={{ flex: 1, minWidth: '120px', background: 'rgba(62, 127, 255, 0.06)', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ color: '#3e7fff', fontWeight: 700, fontSize: '0.9em' }}>Aduana</span>
                          <span style={{ color: '#3e7fff', fontWeight: 700, fontSize: '1.4em' }}>{aduTotal.toLocaleString('es-AR')}</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(62, 127, 255, 0.15)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(aduTotal / maxBar) * 100}%`, background: '#3e7fff', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                        </div>
                        {total > 0 && <p style={{ color: '#888', fontSize: '0.78em', margin: '6px 0 0 0' }}>{((aduTotal / total) * 100).toFixed(1)}%</p>}
                      </div>
                      {/* Artilleros */}
                      <div style={{ flex: 1, minWidth: '120px', background: 'rgba(6, 182, 212, 0.06)', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ color: '#06b6d4', fontWeight: 700, fontSize: '0.9em' }}>Artilleros</span>
                          <span style={{ color: '#06b6d4', fontWeight: 700, fontSize: '1.4em' }}>{artTotal.toLocaleString('es-AR')}</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(6, 182, 212, 0.15)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(artTotal / maxBar) * 100}%`, background: '#06b6d4', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                        </div>
                        {total > 0 && <p style={{ color: '#888', fontSize: '0.78em', margin: '6px 0 0 0' }}>{((artTotal / total) * 100).toFixed(1)}%</p>}
                      </div>
                      {/* Mercado Libre */}
                      <div style={{ flex: 1, minWidth: '120px', background: 'rgba(251, 191, 36, 0.06)', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.9em' }}>ML</span>
                          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1.4em' }}>{mlTotal.toLocaleString('es-AR')}</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(251, 191, 36, 0.15)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(mlTotal / maxBar) * 100}%`, background: '#fbbf24', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                        </div>
                        {total > 0 && <p style={{ color: '#888', fontSize: '0.78em', margin: '6px 0 0 0' }}>{((mlTotal / total) * 100).toFixed(1)}%</p>}
                        {mlInfo.loading && <p style={{ color: '#555', fontSize: '0.72em', margin: '4px 0 0 0' }}>Buscando en ML...</p>}
                        {!mlInfo.loading && mlItems.length > 0 && (
                          <div style={{ marginTop: '6px' }}>
                            <p style={{ color: '#666', fontSize: '0.72em', margin: '0 0 4px 0' }}>{mlItems.length} pub. ({mlInfo.matchType || 'SKU'})</p>
                            {mlItems.map((mp, mi) => (
                              <div key={mi} style={{ fontSize: '0.68em', color: '#888', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', gap: '4px', alignItems: 'center' }}>
                                <a href={mp.permalink || `https://www.mercadolibre.com.ar/p/${mp.item_id}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#888', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fbbf24'} onMouseLeave={(e) => e.currentTarget.style.color = '#888'}>{mp.titulo}</a>
                                {mp.has_sku === false && <span style={{ color: '#ef4444', fontSize: '0.9em', fontStyle: 'italic', whiteSpace: 'nowrap' }}>* sin SKU</span>}
                                <span style={{ color: '#fbbf24', fontWeight: 600, whiteSpace: 'nowrap' }}>{mp.stock}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!mlInfo.loading && mlItems.length === 0 && (
                          <p style={{ color: '#555', fontSize: '0.72em', margin: '4px 0 0 0' }}>Sin match en ML</p>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                )
              })}

              {comparadorSelected.length > 1 && (
                <div style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => setComparadorSelected([])}
                    style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '6px', padding: '6px 16px', cursor: 'pointer', fontSize: '0.82em' }}
                  >Limpiar todo</button>
                </div>
              )}
            </div>
          )}
          </div>
        </section>

        </>
        )}

        {activeTab === 'envios' && (
        <>
        {/* ENVÍOS DEL DÍA */}
        <div className="stacked-sections">
          <section className="section">
            <h2>Envíos del Día</h2>
            <p className="section-date">{dateInfo.today}</p>
            {enviosData ? (
              <>
                <div className="cards-grid">
                  {Object.entries(enviosData).filter(([, d]) => !d.error).map(([marca, data]) => (
                    <div key={marca} className="card">
                      {BRAND_LOGOS[marca] ? (
                        <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '8px' }} />
                      ) : (
                        <h3>{marca}</h3>
                      )}
                      <div style={{ textAlign: 'center', margin: '8px 0 4px 0' }}>
                        <p className="total-item-ordenes" style={{ fontSize: '2.21em', margin: 0 }}>{data.hoy?.envios || 0}</p>
                        <p className="total-item-ordenes" style={{ fontSize: '0.85em', margin: '0 0 4px 0' }}>envíos hoy</p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px', fontSize: '0.8em', color: '#999' }}>
                        <span>Semana: <strong style={{ color: '#fff' }}>{data.semana?.envios || 0}</strong></span>
                        <span>Mes: <strong style={{ color: '#fff' }}>{data.mes?.envios || 0}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="totals-row totals-row-small" style={{ marginTop: '16px', gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="total-item">
                    <span>Total Hoy:</span>
                    <span className="total-item-ordenes">{Object.values(enviosData).reduce((s, d) => s + (d.hoy?.envios || 0), 0)} envíos</span>
                  </div>
                  <div className="total-item">
                    <span>Total Semana:</span>
                    <span className="total-item-ordenes">{Object.values(enviosData).reduce((s, d) => s + (d.semana?.envios || 0), 0)} envíos</span>
                  </div>
                  <div className="total-item">
                    <span>Total Mes:</span>
                    <span className="total-item-ordenes">{Object.values(enviosData).reduce((s, d) => s + (d.mes?.envios || 0), 0)} envíos</span>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: '#999', textAlign: 'center' }}>Cargando datos de envíos...</p>
            )}
          </section>
        </div>

        {/* CONSULTA DE ENVÍOS POR RANGO */}
        <section className="section">
          <h2>Consulta de Envíos por Rango</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <DatePicker
              selected={enviosDesde}
              onChange={date => setEnviosDesde(date)}
              selectsStart
              startDate={enviosDesde}
              endDate={enviosHasta}
              maxDate={new Date()}
              locale="es"
              dateFormat="dd/MM/yyyy"
              placeholderText="Desde"
              className="rango-datepicker"
            />
            <span style={{ color: '#7f8c8d' }}>a</span>
            <DatePicker
              selected={enviosHasta}
              onChange={date => setEnviosHasta(date)}
              selectsEnd
              startDate={enviosDesde}
              endDate={enviosHasta}
              minDate={enviosDesde}
              maxDate={new Date()}
              locale="es"
              dateFormat="dd/MM/yyyy"
              placeholderText="Hasta"
              className="rango-datepicker"
            />
            <button onClick={fetchEnviosDetalle} disabled={enviosLoading || !enviosDesde || !enviosHasta}
              style={{ padding: '8px 20px', borderRadius: '20px', border: '1px solid rgba(6, 182, 212, 0.5)', background: enviosLoading ? '#555' : 'rgba(6, 182, 212, 0.2)', color: '#06b6d4', fontWeight: 600, cursor: 'pointer', fontSize: '0.9em' }}>
              {enviosLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {enviosDetalle && (() => {
            const filteredEnvios = enviosMarcaFilter
              ? (enviosDetalle.envios || []).filter(e => e.marca === enviosMarcaFilter)
              : (enviosDetalle.envios || [])
            const filteredTotal = filteredEnvios.length
            const filteredMonto = filteredEnvios.reduce((s, e) => s + (e.monto || 0), 0)
            const filteredPorEstado = {}
            filteredEnvios.forEach(e => { filteredPorEstado[e.status] = (filteredPorEstado[e.status] || 0) + 1 })
            const filteredPorProvincia = {}
            filteredEnvios.forEach(e => {
              const p = e.provincia || 'Desconocida'
              filteredPorProvincia[p] = (filteredPorProvincia[p] || 0) + 1
            })
            const sortedProvincias = Object.entries(filteredPorProvincia).sort((a, b) => b[1] - a[1])
            // Heatmap filtrado
            const filteredHeatmap = enviosHeatmap && enviosMarcaFilter
              ? (() => {
                  const locCounts = {}
                  filteredEnvios.forEach(e => {
                    if (e.ciudad && e.provincia) {
                      const k = `${e.ciudad}|${e.provincia}`
                      locCounts[k] = (locCounts[k] || 0) + 1
                    }
                  })
                  return enviosHeatmap.map(p => {
                    const k = `${p.ciudad}|${p.provincia}`
                    return locCounts[k] ? { ...p, cantidad: locCounts[k] } : null
                  }).filter(Boolean)
                })()
              : enviosHeatmap

            return (
            <>
              {/* Filtro por marca */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
                <button onClick={() => setEnviosMarcaFilter(null)}
                  style={{ padding: '4px 14px', borderRadius: '20px', border: enviosMarcaFilter === null ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.1)', background: enviosMarcaFilter === null ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.05)', color: enviosMarcaFilter === null ? '#06b6d4' : '#999', fontSize: '0.82em', fontWeight: 600, cursor: 'pointer' }}>
                  Todas
                </button>
                {Object.keys(enviosDetalle.por_marca || {}).map(marca => (
                  <button key={marca} onClick={() => setEnviosMarcaFilter(enviosMarcaFilter === marca ? null : marca)}
                    style={{ padding: '4px 14px', borderRadius: '20px', border: enviosMarcaFilter === marca ? '1px solid #d946ef' : '1px solid rgba(255,255,255,0.1)', background: enviosMarcaFilter === marca ? 'rgba(217,70,239,0.15)' : 'rgba(255,255,255,0.05)', color: enviosMarcaFilter === marca ? '#d946ef' : '#999', fontSize: '0.82em', fontWeight: 600, cursor: 'pointer' }}>
                    {marca}
                  </button>
                ))}
              </div>

              <div className="totals-row totals-row-small" style={{ marginBottom: '16px' }}>
                <div className="total-item">
                  <span>Total Rango:</span>
                  <span className="total-item-ordenes">{filteredTotal} envíos</span>
                  <span className="total-item-value" style={{ fontSize: '1.53em' }}>${fmtMoney(filteredMonto)}</span>
                </div>
                <div className="total-item">
                  <span>Prom. diario:</span>
                  <span className="total-item-ordenes">{Math.round(filteredTotal / Math.max(1, Math.ceil((enviosHasta - enviosDesde) / 86400000) + 1))} envíos</span>
                  <span className="total-item-value" style={{ fontSize: '1.53em' }}>${fmtMoney(Math.round(filteredMonto / Math.max(1, Math.ceil((enviosHasta - enviosDesde) / 86400000) + 1)))}</span>
                </div>
              </div>
              <div className="cards-grid">
                {Object.entries(enviosDetalle.por_marca || {}).filter(([marca]) => !enviosMarcaFilter || marca === enviosMarcaFilter).map(([marca, cant]) => {
                  const marcaEnvios = (enviosDetalle.envios || []).filter(e => e.marca === marca)
                  const montoMarca = marcaEnvios.reduce((s, e) => s + (e.monto || 0), 0)
                  const statusCounts = {}
                  marcaEnvios.forEach(e => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1 })
                  const colors = { delivered: '#22c55e', shipped: '#06b6d4', ready_to_ship: '#eab308', handling: '#f59e0b', pending: '#999', cancelled: '#ef4444', not_delivered: '#ef4444' }
                  return (
                    <div key={marca} className="card">
                      {BRAND_LOGOS[marca] ? (
                        <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '8px' }} />
                      ) : (
                        <h3>{marca}</h3>
                      )}
                      <div style={{ textAlign: 'center', margin: '8px 0 4px 0' }}>
                        <p className="total-item-ordenes" style={{ fontSize: '2.21em', margin: 0 }}>{cant}</p>
                        <p className="total-item-ordenes" style={{ fontSize: '0.85em', margin: '0 0 4px 0' }}>envíos</p>
                      </div>
                      <p className="value" style={{ fontSize: '0.68em' }}>${fmtMoney(montoMarca)}</p>
                      {Object.keys(statusCounts).length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                          {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([st, c]) => (
                            <span key={st} style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '0.7em', background: `${colors[st] || '#666'}22`, color: colors[st] || '#999' }}>
                              {st.replace(/_/g, ' ')} {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Estados */}
              {Object.keys(filteredPorEstado).length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '20px', marginBottom: '16px' }}>
                  {Object.entries(filteredPorEstado).sort((a, b) => b[1] - a[1]).map(([estado, cant]) => {
                    const colors = { delivered: '#22c55e', shipped: '#06b6d4', ready_to_ship: '#eab308', handling: '#f59e0b', pending: '#999', cancelled: '#ef4444', not_delivered: '#ef4444' }
                    return (
                      <span key={estado} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8em', fontWeight: 600, background: `${colors[estado] || '#666'}22`, color: colors[estado] || '#999', border: `1px solid ${colors[estado] || '#666'}44` }}>
                        {estado.replace(/_/g, ' ')} · {cant}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Envíos por Provincia + Localidades */}
              {sortedProvincias.length > 0 && (
                <div className="categorias-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
                  {/* Provincias */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.06)', maxHeight: '450px', overflowY: 'auto' }}>
                    <h3 style={{ color: '#fff', fontSize: '1em', fontWeight: 600, margin: '0 0 12px 0' }}>Envíos por Provincia{enviosMarcaFilter ? ` — ${enviosMarcaFilter}` : ''}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {sortedProvincias.slice(0, 15).map(([prov, cant], idx) => {
                        const maxCant = sortedProvincias[0]?.[1] || 1
                        const pct = (cant / maxCant) * 100
                        const rankColors = ['#d946ef', '#06b6d4', '#a855f7']
                        const isSelected = enviosProvincia === prov
                        return (
                          <div key={prov} onClick={() => setEnviosProvincia(isSelected ? null : prov)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: isSelected ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.03)', borderRadius: '6px', cursor: 'pointer', border: isSelected ? '1px solid rgba(6,182,212,0.3)' : '1px solid transparent', transition: 'all 0.2s' }}>
                            <span style={{ width: '24px', textAlign: 'center', fontSize: '0.75em', fontWeight: 700, color: idx < 3 ? rankColors[idx] : '#666' }}>{idx + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span style={{ color: isSelected ? '#06b6d4' : '#fff', fontSize: '0.85em' }}>{prov}</span>
                                <span style={{ color: '#ccc', fontSize: '0.8em' }}>{cant} envíos</span>
                              </div>
                              <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                                <div style={{ height: '100%', width: `${pct}%`, borderRadius: '2px', background: idx < 3 ? rankColors[idx] : 'rgba(255,255,255,0.15)', transition: 'width 0.6s ease' }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Localidades de la provincia seleccionada */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.06)', maxHeight: '450px', overflowY: 'auto' }}>
                    <h3 style={{ color: '#fff', fontSize: '1em', fontWeight: 600, margin: '0 0 12px 0' }}>
                      {enviosProvincia ? `Localidades — ${enviosProvincia}` : 'Localidades'}
                    </h3>
                    {enviosProvincia ? (() => {
                      const localidades = {}
                      ;filteredEnvios.filter(e => e.provincia === enviosProvincia).forEach(e => {
                        const loc = e.ciudad || 'Sin datos'
                        if (!localidades[loc]) localidades[loc] = { cantidad: 0, total: 0 }
                        localidades[loc].cantidad += 1
                        localidades[loc].total += e.monto || 0
                      })
                      const sorted = Object.entries(localidades).sort((a, b) => b[1].cantidad - a[1].cantidad)
                      const maxCant = sorted[0]?.[1]?.cantidad || 1
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {sorted.map(([loc, data], idx) => {
                            const pct = (data.cantidad / maxCant) * 100
                            const rankColors = ['#d946ef', '#06b6d4', '#a855f7']
                            return (
                              <div key={loc} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                                <span style={{ width: '24px', textAlign: 'center', fontSize: '0.75em', fontWeight: 700, color: idx < 3 ? rankColors[idx] : '#666' }}>{idx + 1}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                    <span style={{ color: '#fff', fontSize: '0.85em' }}>{loc}</span>
                                    <span style={{ color: '#ccc', fontSize: '0.8em' }}>{data.cantidad} envíos · ${fmtMoney(data.total)}</span>
                                  </div>
                                  <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: '2px', background: idx < 3 ? rankColors[idx] : 'rgba(255,255,255,0.15)', transition: 'width 0.6s ease' }} />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })() : (
                      <p style={{ color: '#666', fontSize: '0.85em', textAlign: 'center', marginTop: '20px' }}>Hacé click en una provincia para ver sus localidades</p>
                    )}
                  </div>
                </div>
              )}

              {/* Mapa de calor */}
              {filteredHeatmap === null ? (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '40px 20px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '20px', textAlign: 'center' }}>
                  <p style={{ color: '#06b6d4', fontSize: '0.85em' }}>Geocodificando localidades para el mapa de calor...</p>
                </div>
              ) : (
                <EnviosHeatMap points={filteredHeatmap} />
              )}

              {/* Filtro por marca debajo del mapa */}
              {enviosHeatmap && enviosHeatmap.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '12px' }}>
                  <button onClick={() => setEnviosMarcaFilter(null)}
                    style={{ padding: '4px 14px', borderRadius: '20px', border: enviosMarcaFilter === null ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.1)', background: enviosMarcaFilter === null ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.05)', color: enviosMarcaFilter === null ? '#06b6d4' : '#999', fontSize: '0.82em', fontWeight: 600, cursor: 'pointer' }}>
                    Todas
                  </button>
                  {Object.keys(enviosDetalle.por_marca || {}).map(marca => (
                    <button key={marca} onClick={() => setEnviosMarcaFilter(enviosMarcaFilter === marca ? null : marca)}
                      style={{ padding: '4px 14px', borderRadius: '20px', border: enviosMarcaFilter === marca ? '1px solid #d946ef' : '1px solid rgba(255,255,255,0.1)', background: enviosMarcaFilter === marca ? 'rgba(217,70,239,0.15)' : 'rgba(255,255,255,0.05)', color: enviosMarcaFilter === marca ? '#d946ef' : '#999', fontSize: '0.82em', fontWeight: 600, cursor: 'pointer' }}>
                      {marca}
                    </button>
                  ))}
                </div>
              )}

              {/* Listado de envíos — collapsible */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '20px' }}>
                <h3 onClick={() => setEnviosListaOpen(!enviosListaOpen)} style={{ color: '#fff', fontSize: '1em', fontWeight: 600, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Listado de Envíos ({filteredEnvios.length})</span>
                  <span style={{ fontSize: '0.8em', color: '#666', transition: 'transform 0.2s', transform: enviosListaOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </h3>
                {enviosListaOpen && <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82em' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#999', fontWeight: 600 }}>Fecha</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#999', fontWeight: 600 }}>Marca</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#999', fontWeight: 600 }}>Producto</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#999', fontWeight: 600 }}>Monto</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#999', fontWeight: 600 }}>Estado</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#999', fontWeight: 600 }}>Destino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEnvios.slice(0, 100).map((e, idx) => {
                        const colors = { delivered: '#22c55e', shipped: '#06b6d4', ready_to_ship: '#eab308', handling: '#f59e0b', pending: '#999', cancelled: '#ef4444', not_delivered: '#ef4444' }
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px 10px', color: '#ccc', whiteSpace: 'nowrap' }}>{e.fecha}</td>
                            <td style={{ padding: '8px 10px', color: '#fff', fontWeight: 500 }}>{e.marca}</td>
                            <td style={{ padding: '8px 10px', color: '#ccc', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.producto || '-'}</td>
                            <td style={{ padding: '8px 10px', color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' }}>${fmtMoney(e.monto || 0)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.85em', background: `${colors[e.status] || '#666'}22`, color: colors[e.status] || '#999' }}>
                                {e.status?.replace(/_/g, ' ') || '?'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#ccc', whiteSpace: 'nowrap' }}>
                              {e.ciudad && e.provincia ? `${e.ciudad}, ${e.provincia}` : e.provincia || e.ciudad || '-'}
                              {e.cp && <span style={{ color: '#666', marginLeft: '4px' }}>({e.cp})</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {filteredEnvios.length > 100 && (
                    <p style={{ color: '#666', fontSize: '0.8em', textAlign: 'center', marginTop: '8px' }}>Mostrando 100 de {filteredEnvios.length} envíos</p>
                  )}
                </div>}
              </div>
            </>
          )})()}
        </section>
        </>
        )}

        {activeTab === 'status' && (
        <>
          <section className="section">
            <h2 style={{ marginBottom: '4px' }}>Estado del Sistema</h2>
            <p style={{ color: '#7f8c8d', fontSize: '0.9em', marginBottom: '24px' }}>Conexiones y salud de servicios</p>

            {/* CONNECTION CARDS — 3 columns */}
            <div className="status-cards-grid">

              {/* MERCADO LIBRE */}
              <div className="status-service-card">
                <div className="status-service-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="status-icon" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>
                    </div>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1em' }}>Mercado Libre</span>
                  </div>
                  <span className={`status-badge ${systemStatus?.mercadolibre?.connected !== false ? 'status-badge-ok' : 'status-badge-error'}`}>
                    {systemStatus?.mercadolibre?.connected !== false ? 'Conectado' : 'Sin conexión'}
                  </span>
                </div>
                <div className="status-service-rows">
                  <div className="status-row">
                    <span>Última sincronización</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{systemStatus?.mercadolibre?.last_sync || '--:--:--'}</span>
                  </div>
                  <div className="status-row">
                    <span>Token expira</span>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>{systemStatus?.mercadolibre?.token_expires || 'N/A'}</span>
                  </div>
                  <div className="status-row">
                    <span>Auto-refresh</span>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>{systemStatus?.mercadolibre?.auto_refresh ? 'Activo' : 'Inactivo'}</span>
                  </div>
                  <div className="status-row">
                    <span>Cuentas activas</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{systemStatus?.mercadolibre?.accounts || 5}</span>
                  </div>
                </div>
              </div>

              {/* ODOO ERP */}
              <div className="status-service-card">
                <div className="status-service-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="status-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                    </div>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1em' }}>Odoo ERP</span>
                  </div>
                  <span className={`status-badge ${systemStatus?.odoo?.connected === true ? 'status-badge-ok' : systemStatus?.odoo?.connected === false ? 'status-badge-error' : 'status-badge-warn'}`}>
                    {systemStatus?.odoo?.connected === true ? 'Conectado' : systemStatus?.odoo?.connected === false ? 'Sin conexión' : 'Verificando...'}
                  </span>
                </div>
                <div className="status-service-rows">
                  {systemStatus?.odoo?.error && (
                    <div className="status-row" style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', padding: '8px 12px', margin: '0 0 4px 0' }}>
                      <span style={{ color: '#ef4444', fontSize: '0.85em' }}>{systemStatus.odoo.error}</span>
                    </div>
                  )}
                  <div className="status-row">
                    <span>Última sincronización</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{systemStatus?.odoo?.last_sync || '--:--:--'}</span>
                  </div>
                  <div className="status-row">
                    <span>Versión</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{systemStatus?.odoo?.version || '16.0'}</span>
                  </div>
                  <div className="status-row">
                    <span>Base de datos</span>
                    <span style={{ color: '#06b6d4', fontWeight: 600 }}>{systemStatus?.odoo?.database || 'production'}</span>
                  </div>
                </div>
              </div>

              {/* SISTEMA */}
              <div className="status-service-card">
                <div className="status-service-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="status-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    </div>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.1em' }}>Sistema</span>
                  </div>
                  <span className="status-badge status-badge-ok">
                    Operativo
                  </span>
                </div>
                <div className="status-service-rows">
                  <div className="status-row">
                    <span>Uptime</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{systemStatus?.system?.uptime || '--'}</span>
                  </div>
                  <div className="status-row">
                    <span>Versión</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{systemStatus?.system?.version || '2.0.0'}</span>
                  </div>
                  <div className="status-row">
                    <span>Marcas configuradas</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{systemStatus?.mercadolibre?.accounts || 5}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ESTADO DE TOKENS */}
            <div className="status-tokens-section">
              <h3 style={{ color: '#fff', fontSize: '1.1em', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d946ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Estado de Tokens
              </h3>
              <div className="status-tokens-grid">
                {/* ML Access Token */}
                <div className="status-token-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>Mercado Libre Access Token</span>
                    <span className="status-badge status-badge-ok" style={{ fontSize: '0.75em' }}>Válido</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85em' }}>
                      Expira: {systemStatus?.mercadolibre?.token_expires || 'N/A'}
                    </span>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85em' }}>
                      Refresh automático: {systemStatus?.mercadolibre?.auto_refresh ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                {/* Odoo Session */}
                <div className="status-token-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>Odoo Session</span>
                    <span className="status-badge status-badge-ok" style={{ fontSize: '0.75em' }}>Activa</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85em' }}>
                      Database: {systemStatus?.odoo?.database || 'production'}
                    </span>
                    <span style={{ color: '#7f8c8d', fontSize: '0.85em' }}>
                      Versión: {systemStatus?.odoo?.version || '16.0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* TOKENS POR MARCA */}
            {systemStatus?.tokens && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ color: '#fff', fontSize: '1.1em', fontWeight: 700, marginBottom: '16px' }}>Tokens por Marca</h3>
                <div className="status-brand-tokens-grid">
                  {Object.entries(systemStatus.tokens).map(([marca, info]) => {
                    const isValid = info.status === 'valid'
                    return (
                      <div key={marca} className="status-token-brand-card" style={{
                        borderColor: isValid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 191, 36, 0.3)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9em' }}>{marca}</span>
                          <span className={`status-badge ${isValid ? 'status-badge-ok' : 'status-badge-warn'}`} style={{ fontSize: '0.7em' }}>
                            {isValid ? 'Válido' : 'Fallback'}
                          </span>
                        </div>
                        <p style={{ color: '#7f8c8d', fontSize: '0.78em', margin: '8px 0 0 0' }}>
                          {isValid ? `Expira: ${info.expires}` : `Fuente: ${info.source}`}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </section>
        </>
        )}

        {activeTab === 'publicaciones' && (
          <PublicacionesTab ventasMesMl={ventasMesMl} refreshKey={refreshKey} />
        )}

        <div style={{ display: activeTab === 'ventas' ? 'block' : 'none' }}>
          <VentasUnifiedTab testData={testData} refreshKey={refreshKey} />
        </div>

        <div style={{ display: activeTab === 'retail' ? 'block' : 'none' }}>
          <VentasRetailTab refreshKey={refreshKey} />
        </div>

        {activeTab === 'mercadopago' && (
          <MercadoPagoTab refreshKey={refreshKey} />
        )}

        {activeTab === 'monitor' && (
          <MonitorTab testData={testData} salesData={salesData} />
        )}
      </main>

      <footer className="footer">
        <p>Powered by <span className="brand-command">ONEMANDO</span><span className="brand-dot">.</span><span className="brand-ai">ai</span> • Actualizado en tiempo real • <span className="footer-link" onClick={() => setActiveTab('status')}>Status</span></p>
      </footer>
      </div>
    </>
  )
}

export default App
