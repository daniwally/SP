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

  if (loading) return <div className="loading">Cargando dashboard...</div>

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sobrepatas Dashboard</h1>
        <p>MercadoLibre + Odoo</p>
      </header>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          💰 Ventas
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          📦 Stock
        </button>
        <button 
          className="tab-refresh"
          onClick={fetchAllData}
        >
          ↻ Actualizar
        </button>
      </div>

      {activeTab === 'sales' && <SalesTab data={salesData} />}
      {activeTab === 'stock' && <StockTab data={stockData} />}
    </div>
  )
}

export default App
