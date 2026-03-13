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
      
      const [ventasHoy, ventas7dias, ventasMes, stock] = await Promise.all([
        axios.get(API + '/ml/ventas/hoy').catch(() => ({ data: {} })),
        axios.get(API + '/ml/ventas/7dias').catch(() => ({ data: {} })),
        axios.get(API + '/ml/ventas/mes').catch(() => ({ data: {} })),
        axios.get(API + '/odoo/stock/actual').catch(() => ({ data: {} }))
      ])
      
      setSalesData({ 
        hoy: ventasHoy.data, 
        dias7: ventas7dias.data,
        mes: ventasMes.data
      })
      setStockData(stock.data)
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
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
        <h1>SP - MercadoLibre</h1>
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
          {/* STOCK POR MARCA/ALMACÉN */}
          <section className="section">
            <h2>Stock por Marca & Almacén</h2>
            <div className="stock-container">
              {Object.entries(stockData).map(([marca, data]) => (
                <div key={marca} className="stock-brand-card">
                  <h3 style={{ color: '#d946ef', marginBottom: '12px' }}>{marca}</h3>
                  
                  {/* Resumen */}
                  <div style={{ 
                    backgroundColor: 'rgba(6, 182, 212, 0.1)', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    marginBottom: '15px',
                    fontSize: '0.85em'
                  }}>
                    <p><strong>Total:</strong> <span style={{ color: '#06b6d4' }}>{data.total_unidades} unidades</span></p>
                    <p><strong>Costo Inventario:</strong> <span style={{ color: '#86efac' }}>${data.costo_total.toLocaleString()}</span></p>
                  </div>

                  {/* Almacenes */}
                  <div style={{ fontSize: '0.8em' }}>
                    {Object.entries(data.almacenes).map(([almID, almacen]) => (
                      <div key={almID} style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid rgba(217, 70, 239, 0.1)' }}>
                        <p style={{ color: '#fbbf24', fontWeight: 600, marginBottom: '6px' }}>{almacen.nombre}</p>
                        {almacen.productos.map((prod, idx) => (
                          <p key={idx} style={{ color: '#b0b0c0', marginBottom: '3px' }}>
                            {prod.nombre}: <span style={{ color: '#06b6d4' }}>{prod.cantidad}u</span> @ ${prod.costo_unitario.toFixed(2)} ({prod.metodo})
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* RESUMEN DE COSTOS */}
          <section className="section">
            <h2>Resumen de Costos de Inventario</h2>
            <div className="costs-grid">
              {Object.entries(stockData).map(([marca, data]) => {
                const costoPorUnidad = (data.costo_total / data.total_unidades).toFixed(2)
                return (
                  <div key={marca} className="cost-card">
                    <h3 style={{ color: '#06b6d4', marginBottom: '10px' }}>{marca}</h3>
                    <p><strong>Unidades:</strong> <span style={{ color: '#86efac' }}>{data.total_unidades}</span></p>
                    <p><strong>Costo Total:</strong> <span style={{ color: '#d946ef' }}>${data.costo_total.toLocaleString()}</span></p>
                    <p><strong>Costo x Unidad:</strong> <span style={{ color: '#fbbf24' }}>${costoPorUnidad}</span></p>
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
