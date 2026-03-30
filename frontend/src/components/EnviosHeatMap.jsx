import { useEffect, useRef, useState } from 'react'
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

function ResizeMap() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100)
  })
  return null
}

export default function EnviosHeatMap({ points }) {
  const [fullscreen, setFullscreen] = useState(false)

  if (!points || points.length === 0) {
    return (
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '40px 20px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ color: '#666', fontSize: '0.85em' }}>Sin datos de ubicación para el mapa de calor</p>
      </div>
    )
  }

  const containerStyle = fullscreen ? {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999, background: '#0a0a1a', borderRadius: 0, padding: '0',
    border: 'none', margin: 0, overflow: 'hidden',
  } : {
    background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px',
    border: '1px solid rgba(255,255,255,0.06)', marginTop: '20px', overflow: 'hidden',
  }

  const mapHeight = fullscreen ? '100vh' : '450px'

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: fullscreen ? '12px 16px' : '0 8px 8px 8px' }}>
        <h3 style={{ color: '#fff', fontSize: '1em', fontWeight: 600, margin: 0 }}>
          Mapa de Calor — Envíos por Localidad
        </h3>
        <button
          onClick={() => setFullscreen(!fullscreen)}
          style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '6px', padding: '4px 10px', color: '#ccc', fontSize: '0.8em',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          {fullscreen ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              Salir
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              Pantalla completa
            </>
          )}
        </button>
      </div>
      <div style={{ borderRadius: fullscreen ? 0 : '8px', overflow: 'hidden', height: mapHeight }}>
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
          <ResizeMap />
        </MapContainer>
      </div>
      {!fullscreen && (
        <p style={{ color: '#666', fontSize: '0.75em', margin: '8px 8px 4px 8px' }}>{points.length} localidades geocodificadas · Tiles &copy; CARTO</p>
      )}
    </div>
  )
}
