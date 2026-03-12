import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const API = window.location.origin + '/api'
    Promise.all([
      axios.get(API + '/ml/ventas/hoy').catch(() => ({ data: {} })),
      axios.get(API + '/ml/ventas/7dias').catch(() => ({ data: {} }))
    ]).then(([hoy, dias7]) => {
      setData({ hoy: hoy.data, dias7: dias7.data })
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ textAlign: 'center', paddingTop: '40px' }}>Cargando...</div>

  const ventas = data.dias7 || {}
  const marcas = Object.keys(ventas).sort((a, b) => (ventas[b]?.total || 0) - (ventas[a]?.total || 0))
  const total = marcas.reduce((sum, m) => sum + (ventas[m]?.total || 0), 0)

  return (
    <div className="app">
      <h1>Sobrepatas Dashboard</h1>
      <div className="kpis">
        {marcas.map(marca => (
          <div key={marca} className="card">
            <h3>{marca}</h3>
            <p className="amount">${(ventas[marca]?.total || 0).toLocaleString()}</p>
            <p className="orders">{ventas[marca]?.ordenes || 0} órdenes</p>
          </div>
        ))}
      </div>
      <div className="total">
        <h2>Total 7 días: ${total.toLocaleString()}</h2>
      </div>
    </div>
  )
}

export default App
