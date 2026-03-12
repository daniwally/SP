import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'
import SalesTab from './components/SalesTab'
import StockTab from './components/StockTab'

function App() {
  const [activeTab, setActiveTab] = useState('sales')
  const [salesData, setSalesData] = useState({})
  const [stockData, setStockData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      const API = window.location.origin + '/api'
      
      const [ventasHoy, ventas7dias, stockActual] = await Promise.all([
        axios.get(API + '/ml/ventas/hoy').catch(() => ({ data: {} })),
        axios.get(API + '/ml/ventas/7dias').catch(() => ({ data: {} })),
        axios.get(API + '/odoo/stock/actual').catch(() => ({ data: {} }))
      ])
      
      setSalesData({ hoy: ventasHoy.data, dias7: ventas7dias.data })
      setStockData(stockActual.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching data:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando dashboard...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <h1>📊 Sobrepatas Dashboard</h1>
            <p>MercadoLibre + Odoo Intelligence</p>
          </div>
          <button 
            className="btn-refresh-large"
            onClick={fetchAllData}
            title="Actualizar datos"
          >
            ↻
          </button>
        </div>
      </header>

      <nav className="tabs-nav">
        <button 
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          <span className="tab-icon">💰</span>
          <span className="tab-label">Ventas</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          <span className="tab-icon">📦</span>
          <span className="tab-label">Stock</span>
        </button>
      </nav>

      <main className="tab-content">
        {activeTab === 'sales' && <SalesTab data={salesData} />}
        {activeTab === 'stock' && <StockTab data={stockData} />}
      </main>

      <footer className="app-footer">
        <p>Actualizado en tiempo real • Rudolf Dashboard</p>
      </footer>
    </div>
  )
}

export default App
