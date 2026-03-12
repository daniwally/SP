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

  const StockDeposito = ({ deposito, marcas, color = '#06b6d4' }) => (
    <div className="stock-deposito">
      <h3 className="deposito-title" style={{ color }}>{deposito}</h3>
      <div className="stock-marcas">
        {Object.entries(marcas).map(([marca, info]) => (
          <div key={`${deposito}-${marca}`} className="stock-marca">
            <div 
              className="marca-header"
              onClick={() => toggleExpand(deposito, marca)}
            >
              <span className="marca-name">{marca}</span>
              <span className="marca-qty">{info.total.toLocaleString()} unid.</span>
              <span className="expand-icon">
                {expandedDepositoMarca === `${deposito}-${marca}` ? '▼' : '▶'}
              </span>
            </div>
            
            {expandedDepositoMarca === `${deposito}-${marca}` && (
              <div className="productos-list">
                {info.productos && info.productos.length > 0 ? (
                  info.productos.map((prod, idx) => (
                    <div key={idx} className="producto-item">
                      <p className="prod-nombre">{prod.nombre}</p>
                      <p className="prod-detalle">📍 {prod.ubicacion}</p>
                      <p className="prod-detalle">📦 {prod.cantidad.toLocaleString()} unidades</p>
                    </div>
                  ))
                ) : (
                  <p className="prod-detalle">Sin detalles de productos</p>
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
      <div className="stock-summary">
        <div className="stock-card">
          <h4>📊 Stock Total</h4>
          <p className="stock-number">{total.toLocaleString()}</p>
        </div>
        <div className="stock-card" style={{ background: 'linear-gradient(135deg, rgba(255, 199, 0, 0.2), rgba(255, 193, 7, 0.1))' }}>
          <h4>🏭 Artilleros</h4>
          <p className="stock-number" style={{ color: '#ff9800' }}>{totalArtilleros.toLocaleString()}</p>
        </div>
        <div className="stock-card" style={{ background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.2), rgba(63, 81, 181, 0.1))' }}>
          <h4>✈️ Zona Franca</h4>
          <p className="stock-number" style={{ color: '#2196f3' }}>{totalZonaFranca.toLocaleString()}</p>
        </div>
      </div>

      <div className="stock-depositos">
        {Object.keys(artilleros).length > 0 && (
          <StockDeposito deposito="🏭 ARTILLEROS" marcas={artilleros} color="#ff9800" />
        )}
        {Object.keys(zonaFranca).length > 0 && (
          <StockDeposito deposito="✈️ ZONA FRANCA" marcas={zonaFranca} color="#2196f3" />
        )}
        {Object.keys(artilleros).length === 0 && Object.keys(zonaFranca).length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <p>No hay datos de stock disponibles</p>
          </div>
        )}
      </div>
    </div>
  )
}
