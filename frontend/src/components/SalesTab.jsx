export default function SalesTab({ data }) {
  const ventas = data.dias7 || {}
  const marcas = Object.keys(ventas).sort((a, b) => (ventas[b]?.total || 0) - (ventas[a]?.total || 0))
  const totales = marcas.map(m => ventas[m]?.total || 0)
  const total = totales.reduce((a, b) => a + b, 0)

  // Paleta de colores consistente por marca
  const colorMap = {
    SHAQ: '#d946ef',      // Magenta (primary)
    HYDRATE: '#06b6d4',   // Cyan (secondary)
    TIMBERLAND: '#f59e0b', // Amber/Orange
    URBAN_FLOW: '#8b5cf6', // Violet
    STARTER: '#ec4899'     // Pink/Rose
  }

  // Crear KPIs para el sidebar
  const kpis = [
    { label: 'SHAQ', value: ventas.SHAQ?.total || 0, change: '+15%', color: colorMap.SHAQ, width: 85 },
    { label: 'HYDRATE', value: ventas.HYDRATE?.total || 0, change: '+8%', color: colorMap.HYDRATE, width: 45 },
    { label: 'TIMBERLAND', value: ventas.TIMBERLAND?.total || 0, change: '-3%', color: colorMap.TIMBERLAND, width: 42 },
    { label: 'URBAN_FLOW', value: ventas.URBAN_FLOW?.total || 0, change: '+12%', color: colorMap.URBAN_FLOW, width: 38 },
  ]

  // Gráfico de líneas simple con SVG
  const renderLineChart = () => {
    const width = 700
    const height = 200
    const padding = 40
    const maxValue = Math.max(...totales) || 1

    let path = `M ${padding} ${height - padding}`
    
    totales.forEach((val, i) => {
      const x = padding + (i / (totales.length - 1 || 1)) * (width - padding * 2)
      const y = height - padding - (val / maxValue) * (height - padding * 2)
      path += ` L ${x} ${y}`
    })

    return (
      <svg className="wave-svg" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d946ef" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <polyline points={path} fill="none" stroke="url(#lineGradient)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {totales.map((val, i) => {
          const x = padding + (i / (totales.length - 1 || 1)) * (width - padding * 2)
          const y = height - padding - (val / maxValue) * (height - padding * 2)
          return (
            <circle key={i} cx={x} cy={y} r="4" fill="#06b6d4" opacity="0.8" />
          )
        })}
      </svg>
    )
  }

  return (
    <div className="sales-tab">
      {/* SIDEBAR KPIs */}
      <div className="kpi-list">
        {kpis.map(kpi => (
          <div key={kpi.label} className="kpi-item">
            <div className="kpi-number" style={{ color: kpi.color }}>
              {(kpi.value / 1000000).toFixed(1)}M
            </div>
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-change">{kpi.change}</div>
            <div className="kpi-bar">
              <div className="kpi-bar-fill" style={{ width: `${kpi.width}%`, backgroundColor: kpi.color }}></div>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CHARTS */}
      <div className="charts-grid">
        {/* LINE CHART */}
        <div className="chart-card">
          <h3>Ventas Últimos 7 Días</h3>
          <div className="wave-chart">
            {renderLineChart()}
          </div>
        </div>

        {/* CIRCULAR METRICS */}
        <div className="chart-card">
          <h3>Distribución por Marca</h3>
          <div className="metric-row">
            {marcas.map((marca, i) => (
              <div key={marca} className="metric-card">
                <div className="progress-circle-container">
                  <div className="progress-circle">
                    <svg viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                      <circle 
                        cx="50" cy="50" r="45" 
                        fill="none" 
                        stroke={colorMap[marca] || '#d946ef'}
                        strokeWidth="8"
                        strokeDasharray={`${(totales[i] / total) * 283} 283`}
                      />
                    </svg>
                    <div className="progress-text">
                      <div className="progress-percent">{((totales[i] / total) * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
                <div className="metric-label">{marca}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOTAL */}
      <div className="chart-card">
        <h3>Total 7 Días</h3>
        <div style={{ fontSize: '2.5em', fontWeight: 300, color: '#06b6d4', marginTop: '15px', fontFamily: "'Inter', sans-serif" }}>
          ${(total / 1000000).toFixed(2)}M
        </div>
      </div>
    </div>
  )
}
