import { Bar, Pie, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

export default function SalesTab({ data }) {
  const ventas = data.dias7 || {}
  const marcas = Object.keys(ventas).sort((a, b) => (ventas[b]?.total || 0) - (ventas[a]?.total || 0))
  const totales = marcas.map(m => ventas[m]?.total || 0)
  const ordenes = marcas.map(m => ventas[m]?.ordenes || 0)
  const total = totales.reduce((a, b) => a + b, 0)

  const colores = ['#d946ef', '#06b6d4', '#ec4899', '#8b5cf6', '#a890c4']
  const coloresFondo = colores.map(c => c + '40')

  const chartDataBar = {
    labels: marcas,
    datasets: [{
      label: 'Ventas ($)',
      data: totales,
      backgroundColor: coloresFondo,
      borderColor: colores,
      borderWidth: 2,
      borderRadius: 8,
      hoverBackgroundColor: colores.map(c => c + 'cc')
    }]
  }

  const chartDataPie = {
    labels: marcas,
    datasets: [{
      data: totales,
      backgroundColor: colores,
      borderColor: 'rgba(255, 255, 255, 0.8)',
      borderWidth: 2,
      hoverOffset: 15
    }]
  }

  const chartDataDoughnut = {
    labels: marcas,
    datasets: [{
      data: ordenes,
      backgroundColor: coloresFondo,
      borderColor: colores,
      borderWidth: 2,
      hoverOffset: 10
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { size: 12 }, padding: 15, color: '#666' }
      },
      tooltip: {
        backgroundColor: 'rgba(20, 20, 40, 0.9)',
        titleColor: '#d946ef',
        bodyColor: '#fff',
        borderColor: 'rgba(217, 70, 239, 0.5)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(217, 70, 239, 0.05)' } }
    }
  }

  return (
    <div className="sales-tab">
      <div className="kpis">
        {marcas.map(marca => (
          <div key={marca} className="kpi-card">
            <h3>{marca}</h3>
            <p className="kpi-value">${(ventas[marca]?.total || 0).toLocaleString()}</p>
            <p className="kpi-orders">{ventas[marca]?.ordenes || 0} órdenes</p>
          </div>
        ))}
      </div>

      <div className="charts">
        <div className="chart-container">
          <h4 style={{ marginBottom: '15px', color: '#b8859e' }}>Ventas por Marca</h4>
          <Bar data={chartDataBar} options={chartOptions} />
        </div>
        <div className="chart-container">
          <h4 style={{ marginBottom: '15px', color: '#b8859e' }}>Distribución %</h4>
          <Pie data={chartDataPie} options={chartOptions} />
        </div>
        <div className="chart-container">
          <h4 style={{ marginBottom: '15px', color: '#b8859e' }}>Órdenes por Marca</h4>
          <Doughnut data={chartDataDoughnut} options={chartOptions} />
        </div>
      </div>

      <div className="total-card">
        <h2>Total 7 Días</h2>
        <p className="total-value">${total.toLocaleString()}</p>
      </div>
    </div>
  )
}
