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
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="dashboard-wrapper">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1>Sobrepatas</h1>
            <p>Dashboard</p>
          </div>
          
          <nav className="sidebar-tabs">
            <button 
              className={`sidebar-tab ${activeTab === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveTab('sales')}
            >
              💰 Ventas
            </button>
            <button 
              className={`sidebar-tab ${activeTab === 'stock' ? 'active' : ''}`}
              onClick={() => setActiveTab('stock')}
            >
              📦 Stock
            </button>
          </nav>

          <div className="sidebar-refresh">
            <button onClick={fetchAllData} className="btn-refresh">
              ↻ Actualizar
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content">
          {activeTab === 'sales' && <SalesTab data={salesData} />}
          {activeTab === 'stock' && <StockTab data={stockData} />}
        </main>
      </div>
    </div>
  )
}

export default App
