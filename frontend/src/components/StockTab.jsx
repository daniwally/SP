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

  const StockDeposito = ({ deposito, marcas }) => (
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
              <span className="marca-qty">{info.total} unidades</span>
              <span className="expand-icon">
                {expandedDepositoMarca === `${deposito}-${marca}` ? '▼' : '▶'}
              </span>
            </div>
            
            {expandedDepositoMarca === `${deposito}-${marca}` && (
              <div className="productos-list">
                {info.productos && info.productos.map((prod, idx) => (
                  <div key={idx} className="producto-item">
                    <p className="prod-nombre">{prod.nombre}</p>
                    <p className="prod-detalle">{prod.cantidad} unid. - {prod.ubicacion}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="tab-content">
      <div className="stock-summary">
        <div className="stock-card">
          <h4>Total Stock</h4>
          <p className="stock-number">{total}</p>
        </div>
        <div className="stock-card">
          <h4>Artilleros</h4>
          <p className="stock-number">{Object.values(artilleros).reduce((sum, m) => sum + (m.total || 0), 0)}</p>
        </div>
        <div className="stock-card">
          <h4>Zona Franca</h4>
          <p className="stock-number">{Object.values(zonaFranca).reduce((sum, m) => sum + (m.total || 0), 0)}</p>
        </div>
      </div>

      <div className="stock-depositos">
        {Object.keys(artilleros).length > 0 && <StockDeposito deposito="ARTILLEROS" marcas={artilleros} />}
        {Object.keys(zonaFranca).length > 0 && <StockDeposito deposito="ZONA FRANCA" marcas={zonaFranca} />}
      </div>
    </div>
  )
}
