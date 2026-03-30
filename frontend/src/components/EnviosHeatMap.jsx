import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'

function HeatLayer({ points }) {
  const map = useMap()
  const heatLayerRef = useRef(null)

  useEffect(() => {
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current)
    }

    if (points && points.length > 0) {
      const heatData = points.map(p => [p.lat, p.lng, p.cantidad])
      heatLayerRef.current = L.heatLayer(heatData, {
        radius: 30,
        blur: 20,
        maxZoom: 12,
        max: Math.max(...points.map(p => p.cantidad)),
        gradient: {
          0.2: '#06b6d4',
          0.4: '#a855f7',
          0.6: '#d946ef',
          0.8: '#f59e0b',
          1.0: '#ef4444'
        }
      }).addTo(map)
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current)
      }
    }
  }, [points, map])

  return null
}

export default function EnviosHeatMap({ points }) {
  if (!points || points.length === 0) {
    return (
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '40px 20px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ color: '#666', fontSize: '0.85em' }}>Sin datos de ubicación para el mapa de calor</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.06)', marginTop: '20px', overflow: 'hidden' }}>
      <h3 style={{ color: '#fff', fontSize: '1em', fontWeight: 600, margin: '8px 8px 12px 8px' }}>Mapa de Calor — Envíos por Localidad</h3>
      <div style={{ borderRadius: '8px', overflow: 'hidden', height: '450px' }}>
        <MapContainer
          center={[-34.6, -58.4]}
          zoom={5}
          style={{ height: '100%', width: '100%', background: '#1a1a2e' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <HeatLayer points={points} />
        </MapContainer>
      </div>
      <p style={{ color: '#666', fontSize: '0.75em', margin: '8px 8px 4px 8px' }}>{points.length} localidades geocodificadas · Tiles &copy; CARTO</p>
    </div>
  )
}
