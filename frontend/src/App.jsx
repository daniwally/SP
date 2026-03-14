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

// Función para obtener hace 7 días (últimos 7 días)
const getSaturdayOfWeek = (date) => {
  const d = new Date(date)
  d.setDate(d.getDate() - 7)  // ✅ Simplemente restar 7 días
  return d
}

function App() {
  const [salesData, setSalesData] = useState({})
  const [stockData, setStockData] = useState({})
  const [valuationData, setValuationData] = useState({})
  const [testData, setTestData] = useState({})
  const [tokenStatus, setTokenStatus] = useState({})
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
        axios.get(API + '/odoo/stock/actual', axiosConfig),
        axios.get(API + '/odoo/valuacion', axiosConfig),
        axios.get(API + '/test/ventas-detallado', axiosConfig),
        axios.get(API + '/debug/all-accounts', axiosConfig)
      ])
      
      const ventasHoy = results[0].status === 'fulfilled' ? results[0].value.data : {}
      const ventas7dias = results[1].status === 'fulfilled' ? results[1].value.data : {}
      const ventasMes = results[2].status === 'fulfilled' ? results[2].value.data : {}
      const stock = results[3].status === 'fulfilled' ? results[3].value.data : {}
      const valuacion = results[4].status === 'fulfilled' ? results[4].value.data : {}
      const test = results[5].status === 'fulfilled' ? results[5].value.data : {}
      const tokens = results[6].status === 'fulfilled' ? results[6].value.data : {}
      
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
            <button 
              className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
              onClick={() => setActiveTab('status')}
            >
              📊 Status
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
            {/* KPI - Solo Cantidades - Una línea */}
            <div style={{ marginBottom: '25px', textAlign: 'center' }}>
              <div style={{
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(217, 70, 239, 0.2)',
                borderRadius: '12px',
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                gap: '20px'
              }}>
                {/* Total */}
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#7f8c8d', fontSize: '0.7em', fontWeight: 600, marginBottom: '4px' }}>INVENTARIO TOTAL</p>
                  <p style={{ color: '#06b6d4', fontSize: '1.8em', fontWeight: 700, margin: 0 }}>
                    {Object.values(stockData).reduce((sum, marca) => sum + (marca.total_unidades || 0), 0).toLocaleString()}
                  </p>
                </div>

                {/* Separador */}
                <div style={{ width: '1px', height: '50px', background: 'rgba(217, 70, 239, 0.2)' }}></div>

                {/* Artilleros */}
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#7f8c8d', fontSize: '0.7em', fontWeight: 600, marginBottom: '4px' }}>Artilleros</p>
                  <p style={{ color: '#06b6d4', fontSize: '1.8em', fontWeight: 700, margin: 0 }}>
                    {Object.values(stockData).reduce((sum, marca) => {
                      return sum + (marca.almacenes?.['Artilleros']?.productos?.reduce((s, p) => s + (p.cantidad || 0), 0) || 0)
                    }, 0).toLocaleString()}
                  </p>
                </div>

                {/* Separador */}
                <div style={{ width: '1px', height: '50px', background: 'rgba(217, 70, 239, 0.2)' }}></div>

                {/* Aduana */}
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#7f8c8d', fontSize: '0.7em', fontWeight: 600, marginBottom: '4px' }}>Aduana</p>
                  <p style={{ color: '#3e7fff', fontSize: '1.8em', fontWeight: 700, margin: 0 }}>
                    {Object.values(stockData).reduce((sum, marca) => {
                      return sum + (marca.almacenes?.['Aduana (Tránsito – Solo interno)']?.productos?.reduce((s, p) => s + (p.cantidad || 0), 0) || 0)
                    }, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>


          </section>

          {/* INVENTARIO POR MARCA Y DEPÓSITO - PRIMER CARD */}
          <section className="section">
            <h2>📦 Inventario por Marca & Depósito</h2>
            <div className="cards-grid">
              {Object.entries(stockData)
                .filter(([marca]) => ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND'].includes(marca))
                .map(([marca, data]) => {
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
                        <p style={{ color: '#3e7fff', fontSize: '1.3em', fontWeight: 700 }}>{aduana.toLocaleString()}</p>
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

          {/* VALUACIÓN STOCK CRUZADO - ARTILLEROS + ZONA FRANCA */}
          <section className="section">
            <h2>💎 Valuación Stock Cruzado (Artilleros + Zona Franca)</h2>
            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(217, 70, 239, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <p style={{ color: '#06b6d4', fontSize: '2em', fontWeight: 700, margin: '0 0 5px 0', textAlign: 'center' }}>
                ${(valuationData.TOTAL_GENERAL / 1000000000).toFixed(2)}B
              </p>
              <p style={{ color: '#95a5a6', fontSize: '0.9em', textAlign: 'center', margin: 0 }}>
                Valor Total Inventario
              </p>
            </div>

            <div className="cards-grid">
              {Object.entries(valuationData)
                .filter(([key]) => key !== 'TOTAL_GENERAL' && ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND'].includes(key))
                .map(([marca, data]) => {
                  console.log(`Renderizando marca: ${marca}`, data)
                  const artData = data.almacenes?.['ARTILLEROS'] || {}
                  const zfData = data.almacenes?.['ZONA FRANCA'] || {}
                  
                  return (
                    <div key={marca} className="card" style={{
                      borderColor: marca === 'SHAQ' ? 'rgba(217, 70, 239, 0.4)' : 'rgba(6, 182, 212, 0.2)'
                    }}>
                      <h3 style={{ marginBottom: '15px' }}>{marca}</h3>
                      
                      {/* Fila Artilleros */}
                      <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(217, 70, 239, 0.1)' }}>
                        <p style={{ color: '#7f8c8d', fontSize: '0.7em', fontWeight: 600, marginBottom: '4px' }}>ARTILLEROS</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <p style={{ color: '#06b6d4', fontSize: '1.2em', fontWeight: 700, margin: 0 }}>
                            {artData.unidades?.toLocaleString() || 0}
                          </p>
                          <p style={{ color: '#3e7fff', fontSize: '1em', fontWeight: 700, margin: 0 }}>
                            ${(artData.valor / 1000000).toFixed(1)}M
                          </p>
                        </div>
                      </div>

                      {/* Fila Zona Franca */}
                      <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(217, 70, 239, 0.1)' }}>
                        <p style={{ color: '#7f8c8d', fontSize: '0.7em', fontWeight: 600, marginBottom: '4px' }}>ZONA FRANCA</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <p style={{ color: '#06b6d4', fontSize: '1.2em', fontWeight: 700, margin: 0 }}>
                            {zfData.unidades?.toLocaleString() || 0}
                          </p>
                          <p style={{ color: '#3e7fff', fontSize: '1em', fontWeight: 700, margin: 0 }}>
                            ${(zfData.valor / 1000000).toFixed(1)}M
                          </p>
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div>
                        <p style={{ color: '#86efac', fontSize: '0.75em', fontWeight: 700, marginBottom: '4px' }}>SUBTOTAL</p>
                        <p style={{ color: '#d946ef', fontSize: '1.4em', fontWeight: 700, margin: 0 }}>
                          ${(data.total_valor / 1000000).toFixed(1)}M
                        </p>
                        <p style={{ color: '#95a5a6', fontSize: '0.7em', marginTop: '6px' }}>
                          {data.total_unidades?.toLocaleString() || 0} unidades
                        </p>
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>

          {/* RESUMEN STOCK VALORIZADO */}
          <section className="section">
            <h2>📊 Resumen de Stock Valorizado</h2>
            <div style={{
              background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
              border: '2px solid rgba(217, 70, 239, 0.3)',
              borderRadius: '12px',
              padding: '30px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <p style={{ color: '#7f8c8d', fontSize: '0.9em', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase' }}>💰 Valor Total Inventario</p>
              <p style={{ color: '#06b6d4', fontSize: '3em', fontWeight: 900, margin: '0 0 15px 0' }}>
                ${(valuationData.TOTAL_GENERAL / 1000000000).toFixed(2)}B
              </p>
              <p style={{ color: '#95a5a6', fontSize: '0.85em', margin: 0 }}>
                {Object.entries(valuationData)
                  .filter(([key]) => key !== 'TOTAL_GENERAL')
                  .reduce((sum, [, data]) => sum + (data.total_unidades || 0), 0)
                  .toLocaleString()} unidades en stock
              </p>
            </div>

            {/* DESGLOSE POR MARCA */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(217, 70, 239, 0.2)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '0'
            }}>
              <p style={{ color: '#d946ef', fontSize: '0.9em', fontWeight: 700, marginBottom: '15px', textTransform: 'uppercase' }}>Distribución por Marca</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(valuationData)
                  .filter(([key]) => key !== 'TOTAL_GENERAL' && ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND'].includes(key))
                  .sort((a, b) => (b[1].total_valor || 0) - (a[1].total_valor || 0))
                  .map(([marca, data]) => {
                    const percentage = ((data.total_valor || 0) / (valuationData.TOTAL_GENERAL || 1)) * 100
                    return (
                      <div key={marca} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: '0 0 100px' }}>
                          <p style={{ color: '#d946ef', fontWeight: 700, margin: 0, fontSize: '0.9em' }}>{marca}</p>
                        </div>
                        <div style={{ 
                          flex: 1, 
                          background: 'rgba(217, 70, 239, 0.1)',
                          borderRadius: '4px',
                          height: '24px',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            background: 'linear-gradient(90deg, #d946ef, #06b6d4)',
                            height: '100%',
                            width: `${percentage}%`,
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                        <div style={{ flex: '0 0 120px', textAlign: 'right' }}>
                          <p style={{ color: '#06b6d4', fontWeight: 700, margin: 0, fontSize: '0.9em' }}>
                            ${(data.total_valor / 1000000000).toFixed(2)}B
                          </p>
                          <p style={{ color: '#fbbf24', fontWeight: 600, margin: 0, fontSize: '0.75em' }}>
                            {percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
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

            {/* VENTAS POR PERÍODO - 4 COLUMNAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
              
              {/* HOY */}
              <div style={{ background: 'rgba(217, 70, 239, 0.08)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(217, 70, 239, 0.2)' }}>
                <h3 style={{ color: '#d946ef', marginTop: 0, marginBottom: '15px', fontSize: '0.95em', fontWeight: 900 }}>Hoy</h3>
                {Object.entries(testData.hoy || {}).map(([marca, data]) => (
                  <div key={marca} style={{ marginBottom: '12px', fontSize: '0.85em', borderBottom: '1px solid rgba(217, 70, 239, 0.15)', paddingBottom: '8px' }}>
                    <p style={{ margin: '0 0 4px 0', color: '#06b6d4', fontWeight: 600 }}>{marca}</p>
                    <p style={{ margin: '4px 0', color: '#d946ef', fontWeight: 700, fontSize: '0.95em' }}>
                      ${(data.total || 0).toLocaleString()}
                    </p>
                    <p style={{ margin: '2px 0', color: '#7f8c8d', fontSize: '0.75em' }}>
                      {data.ordenes || 0} órdenes
                    </p>
                  </div>
                ))}
                <p style={{ background: 'rgba(217, 70, 239, 0.15)', padding: '10px 8px', borderRadius: '6px', marginTop: '12px', marginBottom: 0, fontWeight: 700, color: '#d946ef', fontSize: '0.9em', textAlign: 'center' }}>
                  ${(testData.totales?.hoy?.total || 0).toLocaleString()}
                </p>
              </div>

              {/* SEMANA */}
              <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <h3 style={{ color: '#06b6d4', marginTop: 0, marginBottom: '15px', fontSize: '0.95em', fontWeight: 900 }}>Últimos 7 Días</h3>
                {Object.entries(testData.semana || {}).map(([marca, data]) => (
                  <div key={marca} style={{ marginBottom: '12px', fontSize: '0.85em', borderBottom: '1px solid rgba(6, 182, 212, 0.15)', paddingBottom: '8px' }}>
                    <p style={{ margin: '0 0 4px 0', color: '#fbbf24', fontWeight: 600 }}>{marca}</p>
                    <p style={{ margin: '4px 0', color: '#06b6d4', fontWeight: 700, fontSize: '0.95em' }}>
                      ${(data.total || 0).toLocaleString()}
                    </p>
                    <p style={{ margin: '2px 0', color: '#7f8c8d', fontSize: '0.75em' }}>
                      {data.ordenes || 0} ord. | Prom: ${(data.promedio || 0).toLocaleString()}
                    </p>
                  </div>
                ))}
                <p style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '10px 8px', borderRadius: '6px', marginTop: '12px', marginBottom: 0, fontWeight: 700, color: '#06b6d4', fontSize: '0.9em', textAlign: 'center' }}>
                  ${(testData.totales?.semana?.total || 0).toLocaleString()}
                </p>
              </div>

              {/* MES */}
              <div style={{ background: 'rgba(251, 191, 36, 0.08)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                <h3 style={{ color: '#fbbf24', marginTop: 0, marginBottom: '15px', fontSize: '0.95em', fontWeight: 900 }}>Últimos 30 Días</h3>
                {Object.entries(testData.mes || {}).map(([marca, data]) => (
                  <div key={marca} style={{ marginBottom: '12px', fontSize: '0.85em', borderBottom: '1px solid rgba(251, 191, 36, 0.15)', paddingBottom: '8px' }}>
                    <p style={{ margin: '0 0 4px 0', color: '#d946ef', fontWeight: 600 }}>{marca}</p>
                    <p style={{ margin: '4px 0', color: '#fbbf24', fontWeight: 700, fontSize: '0.95em' }}>
                      ${(data.total || 0).toLocaleString()}
                    </p>
                    <p style={{ margin: '2px 0', color: '#7f8c8d', fontSize: '0.75em' }}>
                      {data.ordenes || 0} ord. | Prom: ${(data.promedio || 0).toLocaleString()}
                    </p>
                  </div>
                ))}
                <p style={{ background: 'rgba(251, 191, 36, 0.15)', padding: '10px 8px', borderRadius: '6px', marginTop: '12px', marginBottom: 0, fontWeight: 700, color: '#fbbf24', fontSize: '0.9em', textAlign: 'center' }}>
                  ${(testData.totales?.mes?.total || 0).toLocaleString()}
                </p>
              </div>

              {/* AÑO */}
              <div style={{ background: 'rgba(34, 197, 94, 0.08)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <h3 style={{ color: '#22c55e', marginTop: 0, marginBottom: '15px', fontSize: '0.95em', fontWeight: 900 }}>Últimos 365 Días</h3>
                {Object.entries(testData.año || {}).map(([marca, data]) => (
                  <div key={marca} style={{ marginBottom: '12px', fontSize: '0.85em', borderBottom: '1px solid rgba(34, 197, 94, 0.15)', paddingBottom: '8px' }}>
                    <p style={{ margin: '0 0 4px 0', color: '#06b6d4', fontWeight: 600 }}>{marca}</p>
                    <p style={{ margin: '4px 0', color: '#22c55e', fontWeight: 700, fontSize: '0.95em' }}>
                      ${(data.total || 0).toLocaleString()}
                    </p>
                    <p style={{ margin: '2px 0', color: '#7f8c8d', fontSize: '0.75em' }}>
                      {data.ordenes || 0} ord. | Prom: ${(data.promedio || 0).toLocaleString()}
                    </p>
                  </div>
                ))}
                <p style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '10px 8px', borderRadius: '6px', marginTop: '12px', marginBottom: 0, fontWeight: 700, color: '#22c55e', fontSize: '0.9em', textAlign: 'center' }}>
                  ${(testData.totales?.año?.total || 0).toLocaleString()}
                </p>
              </div>
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
