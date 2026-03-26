import { useState, useEffect } from 'react'
import axios from 'axios'
import DatePicker, { registerLocale } from 'react-datepicker'
import es from 'date-fns/locale/es'
import 'react-datepicker/dist/react-datepicker.css'

registerLocale('es', es)
import RotatingBackground from './components/RotatingBackground'
import PublicacionesTab from './components/PublicacionesTab'
import VentasRetailTab from './components/VentasRetailTab'
import VentasUnifiedTab from './components/VentasUnifiedTab'

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
const fmtMoney = (n) => Math.round(n).toLocaleString('es-AR')

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
  const [valuationData, setValuationData] = useState({})
  const [testData, setTestData] = useState({})
  const [tokenStatus, setTokenStatus] = useState({})
  const [mlPreciosData, setMlPreciosData] = useState({})
  const [loading, setLoading] = useState(true)
  const [dateInfo, setDateInfo] = useState({ today: '', weekRange: '' })
  const [activeTab, setActiveTab] = useState('mercadolibre')
  const [rangoDesde, setRangoDesde] = useState(null)
  const [rangoHasta, setRangoHasta] = useState(null)
  const [rangoData, setRangoData] = useState(null)
  const [rangoLoading, setRangoLoading] = useState(false)

  useEffect(() => {
    const today = new Date()
    const saturday = getSaturdayOfWeek(today)
    
    setDateInfo({
      today: formatDateSpanish(today),
      weekRange: `${formatDateSpanish(saturday)} - ${formatDateSpanish(today)}`
    })
    
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    try {
      setLoading(true)
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
        axios.get(API + '/publicaciones/precios-promedio', axiosConfig)
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
      
      console.log('✅ Data fetched:', { ventasHoy, ventas7dias, ventasMes, stock, valuacion })
      
      setSalesData({ 
        hoy: ventasHoy, 
        dias7: ventas7dias,
        mes: ventasMes
      })
      setStockData(stock)
      setValuationData(valuacion)
      setTestData(test)
      setTokenStatus(tokens)
      setMlPreciosData(mlPrecios.precios || {})
      
      // Debug: verificar valuacion
      console.log('📊 Valuacion data loaded:', {
        total_general: valuacion.TOTAL_GENERAL,
        marcas: Object.keys(valuacion).filter(k => k !== 'TOTAL_GENERAL')
      })
      
      setLoading(false)
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
          <p className="loading-subtitle">Cargando datos de Mercado Libre y Odoo</p>
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
  
  // Top 3 marcas del mes
  const marcasOrdenadas = Object.entries(ventasMes)
    .sort(([, a], [, b]) => (b.total || 0) - (a.total || 0))
    .slice(0, 3)

  return (
    <>
      <RotatingBackground />
      <div className="app">
        <header className="header">
        <h1>SP</h1>
        <div className="header-actions">
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === 'mercadolibre' ? 'active' : ''}`}
              onClick={() => setActiveTab('mercadolibre')}
            >
              💰 Ventas e-commerce
            </button>
            <button
              className={`tab-btn ${activeTab === 'retail' ? 'active' : ''}`}
              onClick={() => setActiveTab('retail')}
            >
              🏪 Ventas Retail
            </button>
            <button
              className={`tab-btn ${activeTab === 'ventas' ? 'active' : ''}`}
              onClick={() => setActiveTab('ventas')}
            >
              📊 Ventas
            </button>
            <button
              className={`tab-btn ${activeTab === 'publicaciones' ? 'active' : ''}`}
              onClick={() => setActiveTab('publicaciones')}
            >
              📋 Publicaciones
            </button>
            <button
              className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
              onClick={() => setActiveTab('stock')}
            >
              📦 Stock
            </button>
            <button
              className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
              onClick={() => setActiveTab('status')}
            >
              ⚙️ Status
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
                    <p className="total-item-ordenes" style={{ fontSize: '0.85em', margin: '0 0 4px 0' }}>órdenes</p>
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
              <span>Total Hoy:</span>
              <span className="total-item-ordenes">{ordenesHoy} órdenes</span>
              <span className="total-item-value">${fmtMoney(totalHoy)}</span>
            </div>
            <div className="total-item">
              <span>Total Semana:</span>
              <span className="total-item-ordenes">{ordenes7d} órdenes</span>
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
                    <p className="total-item-ordenes" style={{ fontSize: '0.85em', margin: '0 0 4px 0' }}>órdenes</p>
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
          <div className="section-2col">
            <div className="compare-card">
              <p className="big-number">${(totalMensual / 1000000).toFixed(2)}M</p>
              <p className="subtitle">Acumulado de {getCurrentMonthName()}</p>
            </div>

            <div className="compare-card">
              <p className="big-number">${fmtMoney(Math.round(totalMensual / new Date().getDate()))}</p>
              <p className="subtitle">Promedio diario del mes</p>
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
              style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: rangoLoading ? '#555' : 'linear-gradient(135deg, #d946ef, #06b6d4)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9em' }}>
              {rangoLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {rangoData && (
            <>
              <div className="totals-row totals-row-small" style={{ marginBottom: '16px' }}>
                <div className="total-item">
                  <span>Total Rango:</span>
                  <span className="total-item-ordenes">{rangoData.totales?.ordenes || 0} órdenes</span>
                  <span className="total-item-value" style={{ fontSize: '1.53em' }}>${fmtMoney(rangoData.totales?.total || 0)}</span>
                </div>
                <div className="total-item">
                  <span>Prom. diario:</span>
                  <span className="total-item-ordenes">{Math.round((rangoData.totales?.ordenes || 0) / Math.max(1, Math.ceil((rangoHasta - rangoDesde) / 86400000) + 1))} órdenes</span>
                  <span className="total-item-value" style={{ fontSize: '1.53em' }}>${fmtMoney(Math.round((rangoData.totales?.total || 0) / Math.max(1, Math.ceil((rangoHasta - rangoDesde) / 86400000) + 1)))}</span>
                </div>
              </div>
              <div className="cards-grid">
                {Object.entries(rangoData).filter(([k]) => k !== 'totales').map(([marca, data]) => (
                  <div key={marca} className="card">
                    {BRAND_LOGOS[marca] ? (
                      <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '8px' }} />
                    ) : (
                      <h3>{marca}</h3>
                    )}
                    <div style={{ textAlign: 'center', margin: '8px 0 4px 0' }}>
                      <p className="total-item-ordenes" style={{ fontSize: '2.21em', margin: 0 }}>{data.ordenes || 0}</p>
                      <p className="total-item-ordenes" style={{ fontSize: '0.85em', margin: '0 0 4px 0' }}>órdenes</p>
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
                    onClick={() => setExpandedBrand(isActive ? null : marca)}
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
                {Object.entries(almacenes).map(([whName, whData]) => (
                  <div key={whName} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid rgba(217, 70, 239, 0.15)' }}>
                      <span style={{ color: whName.includes('Aduana') ? '#3e7fff' : '#06b6d4', fontWeight: 700, fontSize: '0.95em' }}>{whName}</span>
                      <span style={{ color: '#888', fontSize: '0.85em' }}>{(whData.total || 0).toLocaleString('es-AR')} unidades</span>
                    </div>
                    <table className="retail-table" style={{ fontSize: '0.82em' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '50%' }}>Producto</th>
                          <th style={{ textAlign: 'right' }}>Cantidad</th>
                          <th style={{ textAlign: 'right' }}>Costo Unit.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(whData.productos || [])
                          .sort((a, b) => b.cantidad - a.cantidad)
                          .map((prod, idx) => (
                          <tr key={idx}>
                            <td style={{ whiteSpace: 'normal', maxWidth: '400px' }}>{prod.nombre}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{prod.cantidad.toLocaleString('es-AR')}</td>
                            <td style={{ textAlign: 'right', color: '#22c55e' }}>${prod.costo_unitario?.toLocaleString('es-AR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )
          })()}
        </section>

        </>
        )}

        {activeTab === 'status' && (
        <>
          <section className="section">
            <h2>📊 Status ML - Token Connections</h2>
            
            {/* TOKEN STATUS - TOP SECTION */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
              gap: '15px', 
              marginBottom: '30px',
              marginTop: '20px' 
            }}>
              {Object.entries(tokenStatus).length > 0 ? (
                Object.entries(tokenStatus).map(([marca, data]) => {
                  const todayData = testData.hoy?.[marca] || {}
                  const isOK = data.status?.includes('✅')
                  return (
                    <div key={marca} className="card" style={{ 
                      borderColor: isOK ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                      background: isOK ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)'
                    }}>
                      <h3 style={{ color: isOK ? '#22c55e' : '#ef4444' }}>{marca}</h3>
                      <p className="value" style={{ color: isOK ? '#22c55e' : '#ef4444', marginBottom: '6px' }}>
                        {data.status}
                      </p>
                      <p className="subtitle">Token ML</p>
                      <p style={{ fontSize: '0.75em', color: '#fbbf24', fontWeight: 700, marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(217, 70, 239, 0.1)' }}>
                        {todayData.ordenes !== undefined ? todayData.ordenes : 0} órdenes hoy
                      </p>
                    </div>
                  )
                })
              ) : (
                <p style={{ color: '#b0b0c0' }}>Cargando estado de tokens...</p>
              )}
            </div>

          </section>
        </>
        )}

        {activeTab === 'publicaciones' && (
          <PublicacionesTab ventasMesMl={ventasMesMl} />
        )}

        {activeTab === 'ventas' && (
          <VentasUnifiedTab testData={testData} />
        )}

        {activeTab === 'retail' && (
          <VentasRetailTab />
        )}
      </main>

      <footer className="footer">
        <p>Actualizado en tiempo real • Rudolf Dashboard</p>
      </footer>
      </div>
    </>
  )
}

export default App
