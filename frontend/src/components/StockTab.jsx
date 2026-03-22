import { useState } from 'react'

export default function StockTab({ data }) {
  const [expandedDepositoMarca, setExpandedDepositoMarca] = useState(null)
  
  const artilleros = data.ARTILLEROS || {}
  const zonaFranca = data.ZONA_FRANCA || {}
  const total = data.total || 0

  const toggleExpand = (deposito, marca) => {
    const key = `${deposito}-${marca}`
    setExpandedDepositoMarca(expandedDepositoMarca === key ? null : key)
  }

  const totalArtilleros = Object.values(artilleros).reduce((sum, m) => sum + (m.total || 0), 0)
  const totalZonaFranca = Object.values(zonaFranca).reduce((sum, m) => sum + (m.total || 0), 0)

  // KPIs para sidebar
  const kpis = [
    { label: 'Stock Total', value: total, bar: 'bar-violet', width: 95 },
    { label: 'Artilleros', value: totalArtilleros, bar: 'bar-orange', width: 75 },
    { label: 'Zona Franca', value: totalZonaFranca, bar: 'bar-cyan', width: 65 },
  ]

  const StockDeposito = ({ deposito, marcas, color = '#06b6d4' }) => (
    <div className="stock-deposito">
      <h3 className="deposito-title">{deposito}</h3>
      <div className="stock-marcas">
        {Object.entries(marcas).map(([marca, info]) => (
          <div key={`${deposito}-${marca}`} className="stock-marca">
            <div 
              className="marca-header"
              onClick={() => toggleExpand(deposito, marca)}
            >
              <span className="marca-name">{marca}</span>
              <span className="marca-qty">{info.total.toLocaleString()} unid.</span>
            </div>
            
            {expandedDepositoMarca === `${deposito}-${marca}` && (
              <div className="productos-list">
                {info.productos && info.productos.length > 0 ? (
                  info.productos.map((prod, idx) => (
                    <div key={idx} className="producto-item">
                      <p><strong>{prod.nombre}</strong></p>
                      <p>📍 {prod.ubicacion}</p>
                      <p>📦 {prod.cantidad.toLocaleString()} unidades</p>
                    </div>
                  ))
                ) : (
                  <p className="producto-item">Sin detalles</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="stock-tab">
      {/* SIDEBAR KPIs */}
      <div className="kpi-list">
        {kpis.map(kpi => (
          <div key={kpi.label} className="kpi-item">
            <div className="kpi-number">
              {kpi.value.toLocaleString()}
            </div>
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-bar">
              <div className={`kpi-bar-fill ${kpi.bar}`} style={{ width: `${kpi.width}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <div className="charts-grid" style={{ gridColumn: 'span 100%' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          {Object.keys(artilleros).length > 0 && (
            <StockDeposito deposito="🏭 ARTILLEROS" marcas={artilleros} color="#ff9800" />
          )}
          {Object.keys(zonaFranca).length > 0 && (
            <StockDeposito deposito="✈️ ZONA FRANCA" marcas={zonaFranca} color="#2196f3" />
          )}
          {Object.keys(artilleros).length === 0 && Object.keys(zonaFranca).length === 0 && (
            <div className="chart-card">
              <p style={{ textAlign: 'center', color: '#95a5a6' }}>No hay datos de stock disponibles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
