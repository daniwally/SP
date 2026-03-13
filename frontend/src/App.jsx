import { useState, useEffect } from 'react'
import axios from 'axios'
import RotatingBackground from './components/RotatingBackground'
import './App.css'

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

// Función para obtener el sábado de esta semana
const getSaturdayOfWeek = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  // Si hoy es sábado (6), devolver hoy. Si es domingo (0), devolver hace 1 día. etc.
  const diff = day === 6 ? 0 : day === 0 ? 1 : day + 1
  d.setDate(d.getDate() - diff)
  return d
}

function App() {
  const [salesData, setSalesData] = useState({})
  const [stockData, setStockData] = useState({})
  const [loading, setLoading] = useState(true)
  const [dateInfo, setDateInfo] = useState({ today: '', weekRange: '' })
  const [activeTab, setActiveTab] = useState('mercadolibre')

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
      
      const axiosConfig = { timeout: 10000 }
      
      const results = await Promise.allSettled([
        axios.get(API + '/ml/ventas/hoy', axiosConfig),
        axios.get(API + '/ml/ventas/7dias', axiosConfig),
        axios.get(API + '/ml/ventas/mes', axiosConfig),
        axios.get(API + '/odoo/stock/actual', axiosConfig)
      ])
      
      const ventasHoy = results[0].status === 'fulfilled' ? results[0].value.data : {}
      const ventas7dias = results[1].status === 'fulfilled' ? results[1].value.data : {}
      const ventasMes = results[2].status === 'fulfilled' ? results[2].value.data : {}
      const stock = results[3].status === 'fulfilled' ? results[3].value.data : {}
      
      console.log('✅ Data fetched:', { ventasHoy, ventas7dias, ventasMes, stock })
      
      setSalesData({ 
        hoy: ventasHoy, 
        dias7: ventas7dias,
        mes: ventasMes
      })
      setStockData(stock)
      setLoading(false)
    } catch (error) {
      console.error('❌ Error fetching data:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Cargando datos...</p>
      </div>
    )
  }

  const ventasHoy = salesData.hoy || {}
  const ventas7d = salesData.dias7 || {}
  const ventasMes = salesData.mes || {}
  
  // Calcular totales
  const totalHoy = Object.values(ventasHoy).reduce((sum, v) => sum + (v.total || 0), 0)
  const total7d = Object.values(ventas7d).reduce((sum, v) => sum + (v.total || 0), 0)
  const totalMensual = Object.values(ventasMes).reduce((sum, v) => sum + (v.total || 0), 0)
  
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
              className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
              onClick={() => setActiveTab('stock')}
            >
              📦 Stock
            </button>
          </div>
          <button onClick={fetchAllData} className="btn-refresh">↻</button>
        </div>
      </header>

      <main className="dashboard">
        {activeTab === 'mercadolibre' && (
        <>
        {/* VENTAS DEL DÍA Y SEMANAL EN PARALELO */}
        <div className="two-sections">
          {/* VENTAS DEL DÍA */}
          <section className="section">
            <h2>Ventas del Día</h2>
            <p className="section-date">{dateInfo.today}</p>
            <div className="cards-grid">
              {Object.entries(ventasHoy).map(([marca, data]) => (
                <div key={marca} className="card">
                  <h3>{marca}</h3>
                  <p className="value">${(data.total || 0).toLocaleString()}</p>
                  <p className="subtitle">{data.ordenes || 0} órdenes</p>
                  {data.productos && data.productos.length > 0 && (
                    <div className="productos-list">
                      {data.productos.map((prod, idx) => (
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

          {/* VENTAS DE LA SEMANA */}
          <section className="section">
            <h2>Ventas de la Semana</h2>
            <p className="section-date">{dateInfo.weekRange}</p>
            <div className="cards-grid">
              {Object.entries(ventas7d).map(([marca, data]) => (
                <div key={marca} className="card">
                  <h3>{marca}</h3>
                  <p className="value">${(data.total || 0).toLocaleString()}</p>
                  <p className="subtitle">{data.ordenes || 0} órdenes</p>
                  {data.productos && data.productos.length > 0 && (
                    <div className="productos-list">
                      {data.productos.map((prod, idx) => (
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

        {/* TOTALES EN LÍNEA */}
        <div className="totals-row">
          <div className="total-item">
            <span>Total Hoy:</span>
            <span className="total-item-value">${totalHoy.toLocaleString()}</span>
          </div>
          <div className="total-item">
            <span>Total Semana:</span>
            <span className="total-item-value">${total7d.toLocaleString()}</span>
          </div>
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
              <p className="big-number">${(total7d / 7 / 1000).toFixed(0)}K</p>
              <p className="subtitle">Promedio diario (últimos 7 días)</p>
            </div>
          </div>
        </section>

        {/* TOP 3 MARCAS DEL MES */}
        <section className="section">
          <h2>Top 3 Marcas - Mes</h2>
          <div className="top3-container">
            {marcasOrdenadas.map(([marca, data], idx) => (
              <div key={marca} className={`top3-card rank-${idx + 1}`}>
                <div className="rank-badge">{idx + 1}</div>
                <h3>{marca}</h3>
                <p className="top3-value">${(data.total / 1000000).toFixed(2)}M</p>
                <p className="top3-orders">{data.ordenes || 0} órdenes</p>
                <p className="top3-percent">
                  {((data.total / totalMensual) * 100).toFixed(1)}% del total
                </p>
                
                {/* TOP 5 PRODUCTOS DE LA MARCA */}
                {data.productos && data.productos.length > 0 && (
                  <div className="top5-productos">
                    {data.productos.slice(0, 5).map((prod, pidx) => (
                      <p key={pidx} className="top5-item">
                        {prod.nombre} <span className="top5-qty">x{prod.cantidad}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* PREGUNTAS Y RESPUESTAS POR MARCA */}
        <section className="section">
          <h2>Preguntas & Respuestas</h2>
          <div className="questions-grid">
            {Object.entries(ventasMes).map(([marca, data]) => {
              const preg = data.preguntas || { total: 0, sin_responder: 0, tiempo_promedio_horas: 0, tasa_respuesta: 0 }
              return (
                <div key={marca} className="question-card">
                  <h3 style={{ color: '#06b6d4', marginBottom: '12px' }}>{marca}</h3>
                  <div style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
                    <p><strong>Total preguntas:</strong> <span style={{ color: '#06b6d4' }}>{preg.total}</span></p>
                    <p><strong>Sin responder:</strong> <span style={{ color: preg.sin_responder > 10 ? '#ef4444' : '#86efac' }}>{preg.sin_responder}</span> {preg.sin_responder > 10 && '⚠️'}</p>
                    <p><strong>Tiempo promedio:</strong> <span style={{ color: '#86efac' }}>{preg.tiempo_promedio_horas.toFixed(1)}h</span></p>
                    <p><strong>Tasa respuesta:</strong> <span style={{ color: preg.tasa_respuesta >= 90 ? '#86efac' : '#fbbf24' }}>{preg.tasa_respuesta.toFixed(1)}%</span></p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ALERTAS Y RECOMENDACIONES POR MARCA */}
        <section className="section">
          <h2>📋 Alertas & Recomendaciones</h2>
          <div className="alerts-grid">
            {Object.entries(ventasMes).map(([marca, data]) => (
              <div key={marca} className="alert-card">
                <h3 style={{ color: '#d946ef', marginBottom: '12px' }}>{marca}</h3>
                
                {/* ALERTAS */}
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ fontSize: '0.8em', color: '#fbbf24', fontWeight: 700, marginBottom: '6px' }}>⚠️ ALERTAS:</p>
                  {data.alertas && data.alertas.map((alerta, idx) => (
                    <p key={idx} style={{
                      fontSize: '0.75em',
                      color: '#f5f5f5',
                      marginBottom: '4px',
                      lineHeight: '1.3'
                    }}>
                      • {alerta}
                    </p>
                  ))}
                </div>

                {/* RECOMENDACIONES */}
                <div>
                  <p style={{ fontSize: '0.8em', color: '#06b6d4', fontWeight: 700, marginBottom: '6px' }}>💡 RECOMENDACIONES:</p>
                  {data.recomendaciones && data.recomendaciones.map((rec, idx) => (
                    <p key={idx} style={{
                      fontSize: '0.75em',
                      color: '#b0e0e6',
                      marginBottom: '4px',
                      lineHeight: '1.3'
                    }}>
                      • {rec}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        </>
        )}

        {activeTab === 'stock' && (
        <>
          {/* KPI CARDS - TOTAL INVENTARIO + POR MARCA */}
          <section className="section">
            {/* KPI - Solo Cantidades */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(217, 70, 239, 0.2)',
                borderRadius: '12px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#7f8c8d', fontSize: '0.8em', fontWeight: 600, marginBottom: '12px' }}>INVENTARIO TOTAL</p>
                <p style={{ color: '#06b6d4', fontSize: '2.5em', fontWeight: 700, marginBottom: '15px' }}>
                  {Object.values(stockData).reduce((sum, marca) => sum + (marca.total_unidades || 0), 0).toLocaleString()}
                </p>
                
                {/* Desglose por Depósito */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(217, 70, 239, 0.1)' }}>
                  <div>
                    <p style={{ color: '#7f8c8d', fontSize: '0.75em', marginBottom: '4px' }}>Artilleros</p>
                    <p style={{ color: '#06b6d4', fontSize: '1.5em', fontWeight: 700 }}>
                      {Object.values(stockData).reduce((sum, marca) => {
                        return sum + (marca.almacenes?.['Artilleros']?.productos?.reduce((s, p) => s + (p.cantidad || 0), 0) || 0)
                      }, 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#7f8c8d', fontSize: '0.75em', marginBottom: '4px' }}>Aduana</p>
                    <p style={{ color: '#fbbf24', fontSize: '1.5em', fontWeight: 700 }}>
                      {Object.values(stockData).reduce((sum, marca) => {
                        return sum + (marca.almacenes?.['Aduana (Tránsito – Solo interno)']?.productos?.reduce((s, p) => s + (p.cantidad || 0), 0) || 0)
                      }, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>


          </section>



          {/* INVENTARIO POR MARCA Y DEPÓSITO */}
          <section className="section">
            <h2>📦 Inventario por Marca & Depósito</h2>
            <div className="cards-grid">
              {Object.entries(stockData).map(([marca, data]) => {
                const artilleros = data.almacenes?.['Artilleros']?.productos?.reduce((s, p) => s + (p.cantidad || 0), 0) || 0
                const aduana = data.almacenes?.['Aduana (Tránsito – Solo interno)']?.productos?.reduce((s, p) => s + (p.cantidad || 0), 0) || 0
                
                return (
                  <div key={marca} className="card">
                    <h3>{marca}</h3>
                    <div style={{ display: 'flex', gap: '15px', marginTop: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, marginBottom: '6px' }}>Artilleros</p>
                        <p style={{ color: '#06b6d4', fontSize: '1.3em', fontWeight: 700 }}>{artilleros.toLocaleString()}</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: '#7f8c8d', fontSize: '0.75em', fontWeight: 600, marginBottom: '6px' }}>Aduana</p>
                        <p style={{ color: '#fbbf24', fontSize: '1.3em', fontWeight: 700 }}>{aduana.toLocaleString()}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(217, 70, 239, 0.1)' }}>
                      <p style={{ color: '#d946ef', fontSize: '0.85em', fontWeight: 600 }}>Total: {(artilleros + aduana).toLocaleString()}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
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
