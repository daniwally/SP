export default function SalesTab({ data }) {
  const ventas = data.dias7 || {}
  const marcas = Object.keys(ventas).sort((a, b) => (ventas[b]?.total || 0) - (ventas[a]?.total || 0))
  const total = marcas.reduce((sum, m) => sum + (ventas[m]?.total || 0), 0)

  return (
    <div className="tab-content">
      <div className="kpis">
        {marcas.map(marca => (
          <div key={marca} className="kpi-card">
            <h3>{marca}</h3>
            <p className="kpi-value">${(ventas[marca]?.total || 0).toLocaleString()}</p>
            <p className="kpi-orders">{ventas[marca]?.ordenes || 0} órdenes</p>
          </div>
        ))}
      </div>

      <div className="total-card">
        <h2>Total 7 Días</h2>
        <p className="total-value">${total.toLocaleString()}</p>
      </div>
    </div>
  )
}
