import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'

/* ── Heat Layer ─────────────────────────────── */
function HeatLayer({ points }) {
  const map = useMap()
  const heatLayerRef = useRef(null)

  useEffect(() => {
    if (heatLayerRef.current) map.removeLayer(heatLayerRef.current)
    if (points && points.length > 0) {
      const heatData = points.map(p => [p.lat, p.lng, p.cantidad])
      heatLayerRef.current = L.heatLayer(heatData, {
        radius: 50, blur: 35, maxZoom: 14, minOpacity: 0.4,
        max: Math.max(...points.map(p => p.cantidad)),
        gradient: { 0.15: '#06b6d4', 0.35: '#a855f7', 0.55: '#d946ef', 0.75: '#f59e0b', 1.0: '#ef4444' }
      }).addTo(map)
    }
    return () => { if (heatLayerRef.current) map.removeLayer(heatLayerRef.current) }
  }, [points, map])
  return null
}

/* ── Circle Markers Layer ───────────────────── */
function CircleLayer({ points }) {
  const map = useMap()
  const layerRef = useRef(null)

  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current)
    if (points && points.length > 0) {
      const maxCant = Math.max(...points.map(p => p.cantidad))
      const group = L.layerGroup()
      points.forEach(p => {
        const r = 6 + (p.cantidad / maxCant) * 30
        L.circleMarker([p.lat, p.lng], {
          radius: r, fillColor: '#06b6d4', color: 'rgba(6,182,212,0.6)',
          weight: 1, fillOpacity: 0.5,
        }).bindTooltip(`${p.ciudad || ''}, ${p.provincia || ''}: ${p.cantidad} envíos`, { className: 'dark-tooltip' })
          .addTo(group)
      })
      layerRef.current = group.addTo(map)
    }
    return () => { if (layerRef.current) map.removeLayer(layerRef.current) }
  }, [points, map])
  return null
}

/* ── Utility Components ─────────────────────── */
function ResizeMap() {
  const map = useMap()
  useEffect(() => { setTimeout(() => map.invalidateSize(), 100) })
  return null
}

function ZoomFullscreen({ onFullscreen }) {
  const map = useMap()
  return (
    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <button onClick={() => map.zoomIn()}
        style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '1.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      <button onClick={() => map.zoomOut()}
        style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '1.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
      <button onClick={onFullscreen} title="Pantalla completa"
        style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.7)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
      </button>
    </div>
  )
}

/* ── Mode Selector Buttons ──────────────────── */
const MODES = [
  { key: 'heat', label: 'Mapa de Calor' },
  { key: 'circles', label: 'Circle Markers' },
]

/* ── Main Component ─────────────────────────── */
export default function EnviosHeatMap({ points }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [mode, setMode] = useState('heat')

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
  const title = MODES.find(m => m.key === mode)?.label || 'Mapa'

  return (
    <div style={containerStyle}>
      {fullscreen && (
        <div style={{ position: 'absolute', top: '12px', left: '16px', zIndex: 10000, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ color: '#fff', fontSize: '1em', fontWeight: 600, margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {title} — Envíos por Localidad
          </h3>
          <button onClick={() => setFullscreen(false)}
            style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 10px', color: '#ccc', fontSize: '0.8em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            Salir
          </button>
        </div>
      )}
      {!fullscreen && (
        <h3 style={{ color: '#fff', fontSize: '1em', fontWeight: 600, margin: '8px 8px 12px 8px' }}>
          {title} — Envíos por Localidad
        </h3>
      )}
      <div style={{ borderRadius: fullscreen ? 0 : '8px', overflow: 'hidden', height: mapHeight, position: 'relative' }}>
        <MapContainer
          center={[-34.6, -58.4]} zoom={5}
          style={{ height: '100%', width: '100%', background: '#0a0a1a' }}
          zoomControl={false} scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            opacity={0.6}
          />
          {mode === 'heat' && <HeatLayer points={points} />}
          {mode === 'circles' && <CircleLayer points={points} />}
          <ResizeMap />
          <ZoomFullscreen onFullscreen={() => setFullscreen(!fullscreen)} />
        </MapContainer>
      </div>

      {/* Mode selector buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '12px 8px 4px 8px' }}>
        {MODES.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '0.8em', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
              border: mode === m.key ? '1px solid #06b6d4' : '1px solid rgba(6,182,212,0.3)',
              background: mode === m.key ? 'rgba(6,182,212,0.25)' : 'rgba(6,182,212,0.1)',
              color: mode === m.key ? '#06b6d4' : '#888',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {!fullscreen && (
        <p style={{ color: '#666', fontSize: '0.75em', margin: '4px 8px 4px 8px' }}>{points.length} localidades geocodificadas · Tiles &copy; CARTO</p>
      )}
    </div>
  )
}
