import React, { useState, useEffect } from 'react';
import './PublicacionesTab.css';

const MARCAS = ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND', 'URBAN_FLOW'];

const LOGO_BASE = 'https://raw.githubusercontent.com/daniwally/SP/main/logos';
const BRAND_LOGOS = {
  'SHAQ': `${LOGO_BASE}/shaq-logo.png`,
  'STARTER': `${LOGO_BASE}/starter.png`,
  'HYDRATE': `${LOGO_BASE}/hydrate-logo.png`,
  'TIMBERLAND': `${LOGO_BASE}/TBL-logo.png`,
  'URBAN_FLOW': `${LOGO_BASE}/urban-flow-logo.png`,
};

function cleanTitle(titulo) {
  return titulo
    .replace(/zapatillas?\s*(?:de\s+)?basquet/gi, '')
    .replace(/zapatillas?\s*(?:de\s+)?hombre/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activas' },
  { value: 'paused', label: 'Pausadas' },
  { value: 'closed', label: 'Cerradas' },
];

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value" style={{ color: color || '#06b6d4' }}>{value}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  );
}

function KpisSection({ kpis }) {
  if (!kpis || !kpis.total_publicaciones) return null;
  return (
    <div className="kpis-grid">
      <KpiCard label="Publicaciones" value={kpis.total_publicaciones} sub={`${kpis.activas} activas`} />
      <KpiCard label="Stock Total" value={kpis.stock_total?.toLocaleString()} color="#d946ef" />
      <KpiCard label="Vendidas Total" value={kpis.vendidas_total?.toLocaleString()} color="#f59e0b" />
      <KpiCard label="Precio Promedio" value={`$${kpis.precio_promedio?.toLocaleString()}`} color="#86efac" />
      <KpiCard label="Envío Gratis" value={`${kpis.con_envio_gratis}`} sub={`${kpis.pct_envio_gratis}%`} color="#22c55e" />
      <KpiCard label="Valor Stock" value={`$${(kpis.valor_stock_estimado / 1000000).toFixed(1)}M`} color="#d946ef" />
    </div>
  );
}

export default function PublicacionesTab({ ventasMesMl = {} }) {
  const [marca, setMarca] = useState('SHAQ');
  const [statusFilter, setStatusFilter] = useState('active');
  const [viewMode, setViewMode] = useState('marca'); // 'marca' or 'todas'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('vendidas');
  const [sortDir, setSortDir] = useState('desc');
  const [searchText, setSearchText] = useState('');
  const [preview, setPreview] = useState(null);

  // --- Estado para Optimización de Títulos ---
  const [optMarca, setOptMarca] = useState('SHAQ');
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState(null);
  const [optSugerencias, setOptSugerencias] = useState([]);
  const [optStats, setOptStats] = useState(null);
  const [optAprobados, setOptAprobados] = useState({});  // item_id -> bool
  const [optAplicando, setOptAplicando] = useState({});  // item_id -> 'loading' | 'ok' | 'error'
  const [optLimit, setOptLimit] = useState(10);
  const [optShowSection, setOptShowSection] = useState(false);

  // --- Estado para Historial de Títulos ---
  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialShow, setHistorialShow] = useState(false);

  const fetchOptimizacion = async (selectedMarca, limit) => {
    setOptLoading(true);
    setOptError(null);
    setOptSugerencias([]);
    setOptStats(null);
    setOptAprobados({});
    setOptAplicando({});
    try {
      const resp = await fetch(`/api/titulos/optimizar/${selectedMarca}?limit=${limit}`);
      const text = await resp.text();
      let result;
      try { result = JSON.parse(text); } catch { setOptError(`Error del servidor: ${text.slice(0, 150)}`); return; }
      if (resp.status !== 200) {
        setOptError(result.detail || 'Error al optimizar');
        return;
      }
      setOptSugerencias(result.sugerencias || []);
      setOptStats({ total: result.total_analizadas, con_cambios: result.con_cambios });
    } catch (err) {
      setOptError(`Error: ${err.message}`);
    } finally {
      setOptLoading(false);
    }
  };

  const handleAprobar = (itemId) => {
    setOptAprobados(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleAprobarTodos = () => {
    const conCambio = optSugerencias.filter(s => s.tiene_cambio);
    const todosAprobados = conCambio.every(s => optAprobados[s.item_id]);
    if (todosAprobados) {
      setOptAprobados({});
    } else {
      const nuevos = {};
      conCambio.forEach(s => { nuevos[s.item_id] = true; });
      setOptAprobados(nuevos);
    }
  };

  const handleAplicarUno = async (itemId, nuevoTitulo) => {
    setOptAplicando(prev => ({ ...prev, [itemId]: 'loading' }));
    try {
      const resp = await fetch('/api/titulos/aplicar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, nuevo_titulo: nuevoTitulo }),
      });
      if (resp.status === 200) {
        setOptAplicando(prev => ({ ...prev, [itemId]: 'ok' }));
      } else {
        const text = await resp.text();
        setOptAplicando(prev => ({ ...prev, [itemId]: 'error' }));
        console.error('Error aplicando título:', text.slice(0, 200));
      }
    } catch {
      setOptAplicando(prev => ({ ...prev, [itemId]: 'error' }));
    }
  };

  const handleAplicarAprobados = async () => {
    const aprobados = optSugerencias.filter(s => optAprobados[s.item_id] && s.tiene_cambio);
    for (const s of aprobados) {
      await handleAplicarUno(s.item_id, s.titulo_optimizado);
    }
  };

  const aprobadosCount = Object.values(optAprobados).filter(Boolean).length;

  const fetchHistorial = async () => {
    setHistorialLoading(true);
    try {
      const resp = await fetch('/api/titulos/historial?limit=100');
      const data = await resp.json();
      setHistorial(data.historial || []);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setHistorialLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'marca') {
      fetchReporteMarca(marca, statusFilter);
    } else {
      fetchReporteTodas(statusFilter);
    }
  }, [marca, statusFilter, viewMode]);

  const fetchReporteMarca = async (selectedMarca, status) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/publicaciones/reporte/${selectedMarca}?status=${status}`);
      const result = await response.json();
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result);
      }
    } catch (err) {
      setError(`Error cargando publicaciones: ${err.message}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchReporteTodas = async (status) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/publicaciones/reporte-todas?status=${status}`);
      const result = await response.json();
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result);
      }
    } catch (err) {
      setError(`Error cargando publicaciones: ${err.message}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Get all publications for current view
  const getAllPublicaciones = () => {
    if (!data) return [];
    if (viewMode === 'marca') {
      return data.publicaciones || [];
    }
    // todas: merge all brands
    const all = [];
    if (data.datos) {
      Object.entries(data.datos).forEach(([, brandData]) => {
        if (brandData.publicaciones) {
          all.push(...brandData.publicaciones);
        }
      });
    }
    return all;
  };

  // Filter & sort
  const getFilteredPublicaciones = () => {
    let pubs = getAllPublicaciones();

    // Search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      pubs = pubs.filter(p =>
        p.titulo?.toLowerCase().includes(q) ||
        p.item_id?.toLowerCase().includes(q) ||
        p.marca?.toLowerCase().includes(q)
      );
    }

    // Sort
    pubs.sort((a, b) => {
      let va = a[sortField] ?? 0;
      let vb = b[sortField] ?? 0;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (sortDir === 'asc') return va > vb ? 1 : va < vb ? -1 : 0;
      return va < vb ? 1 : va > vb ? -1 : 0;
    });

    return pubs;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIcon = (field) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const kpis = viewMode === 'marca'
    ? data?.kpis
    : data?.kpis_global;

  const publicaciones = getFilteredPublicaciones();

  return (
    <div className="publicaciones-container">
      <h2>Reporte de Publicaciones</h2>

      {/* Controls bar */}
      <div className="controls-bar">
        {/* View mode */}
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'marca' ? 'active' : ''}`}
            onClick={() => setViewMode('marca')}
          >
            Por Marca
          </button>
          <button
            className={`toggle-btn ${viewMode === 'todas' ? 'active' : ''}`}
            onClick={() => setViewMode('todas')}
          >
            Todas las Marcas
          </button>
        </div>

        {/* Brand selector (only in marca mode) */}
        {viewMode === 'marca' && (
          <div className="marca-selector">
            {MARCAS.map(m => (
              <button
                key={m}
                className={`marca-btn ${marca === m ? 'active' : ''}`}
                onClick={() => setMarca(m)}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Status filter */}
        <div className="status-selector">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`status-btn ${statusFilter === opt.value ? 'active' : ''}`}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="search-box">
          <input
            type="text"
            placeholder="Buscar por título, ID o marca..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      {loading && <div className="loading">Cargando publicaciones...</div>}
      {error && <div className="error">{error}</div>}

      {/* KPIs por marca (en vista "todas") */}
      {!loading && viewMode === 'todas' && data?.kpis_por_marca && (
        <div className="marca-kpis-row">
          {Object.entries(data.kpis_por_marca).map(([m, mk]) => (
            <div key={m} className="marca-kpi-card">
              {BRAND_LOGOS[m] ? (
                <img src={BRAND_LOGOS[m]} alt={m} style={{ height: '32px', maxWidth: '140px', objectFit: 'contain', marginBottom: '8px' }} />
              ) : (
                <h4>{m}</h4>
              )}
              <div className="marca-kpi-stats">
                <span>{mk.total_publicaciones} pub</span>
                <span className="sep">|</span>
                <span style={{ color: '#d946ef' }}>{mk.stock_total?.toLocaleString()} stock</span>
                <span className="sep">|</span>
                <span style={{ color: '#f59e0b' }}>{mk.vendidas_total?.toLocaleString()} vendidas</span>
                <span className="sep">|</span>
                <span style={{ color: '#86efac' }}>${(mk.valor_stock_estimado / 1000000).toFixed(1)}M</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && publicaciones.length > 0 && (
        <div className="publicaciones-grid">
          {viewMode === 'marca' && BRAND_LOGOS[marca] && (
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '58px', maxWidth: '240px', objectFit: 'contain' }} />
            </div>
          )}
          {/* KPIs debajo del logo */}
          {!loading && kpis && <KpisSection kpis={kpis} />}
          <table className="publicaciones-table">
            <thead>
              <tr>
                {viewMode === 'todas' && (
                  <th className="sortable" onClick={() => handleSort('marca')}>
                    Marca{sortIcon('marca')}
                  </th>
                )}
                <th className="sortable" onClick={() => handleSort('titulo')}>
                  Título{sortIcon('titulo')}
                </th>
                <th className="sortable" onClick={() => handleSort('status')}>
                  Estado{sortIcon('status')}
                </th>
                <th className="sortable" onClick={() => handleSort('precio')}>
                  Precio{sortIcon('precio')}
                </th>
                <th className="sortable" onClick={() => handleSort('health')}>
                  Salud{sortIcon('health')}
                </th>
                <th className="sortable" onClick={() => handleSort('stock')}>
                  Stock{sortIcon('stock')}
                </th>
                <th className="sortable" onClick={() => handleSort('vendidas')}>
                  Vendidas{sortIcon('vendidas')}
                </th>
                <th className="sortable" onClick={() => handleSort('listing_type_label')}>
                  Tipo{sortIcon('listing_type_label')}
                </th>
                <th>Envío</th>
                <th className="sortable" onClick={() => handleSort('condition_label')}>
                  Cond.{sortIcon('condition_label')}
                </th>
                <th className="sortable" onClick={() => handleSort('fotos')}>
                  Fotos{sortIcon('fotos')}
                </th>
                <th className="sortable" onClick={() => handleSort('dias_publicado')}>
                  Días{sortIcon('dias_publicado')}
                </th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {publicaciones.map(pub => (
                <tr key={pub.item_id} className={pub.status !== 'active' ? 'row-inactive' : ''}>
                  {viewMode === 'todas' && (
                    <td className="marca-cell">{pub.marca}</td>
                  )}
                  <td className="titulo" title={pub.titulo}>
                    {pub.thumbnail && (
                      <span
                        className="thumb-wrapper"
                        onMouseEnter={e => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const previewSrc = pub.fotos_urls?.length ? pub.fotos_urls[0] : pub.thumbnail.replace('-I.jpg', '-O.jpg')
                          setPreview({ src: previewSrc, x: rect.right + 8, y: rect.top - 40 })
                        }}
                        onMouseLeave={() => setPreview(null)}
                      >
                        <img src={pub.thumbnail} alt="" className="thumb" />
                      </span>
                    )}
                    <span>{cleanTitle(pub.titulo)}</span>
                  </td>
                  <td>
                    <span className={`status-badge status-${pub.status}`}>
                      {pub.status_label}
                    </span>
                  </td>
                  <td className="precio">
                    ${pub.precio?.toLocaleString()}
                  </td>
                  <td className="health-cell">
                    {pub.health != null ? (
                      <span className={`health-badge ${pub.health >= 0.8 ? 'health-good' : pub.health >= 0.5 ? 'health-mid' : 'health-bad'}`}>
                        {Math.round(pub.health * 100)}%
                      </span>
                    ) : (
                      <span className="sin-descuento">-</span>
                    )}
                  </td>
                  <td className={`stock ${pub.stock === 0 ? 'stock-zero' : pub.stock < 5 ? 'stock-low' : ''}`}>
                    {pub.stock}
                  </td>
                  <td className="vendidas">{pub.vendidas}</td>
                  <td className="tipo">{pub.listing_type_label}</td>
                  <td className="envio">
                    {pub.logistica_full ? (
                      <span className="badge-full" title="Logística Full">FULL</span>
                    ) : pub.envio_gratis ? (
                      <span className="badge-free" title="Envío gratis">Gratis</span>
                    ) : (
                      <span className="badge-paid">Pago</span>
                    )}
                  </td>
                  <td className="condicion">{pub.condition_label}</td>
                  <td className="fotos-cell">{pub.fotos}</td>
                  <td className="dias-cell">{pub.dias_publicado ?? '-'}</td>
                  <td>
                    {pub.permalink ? (
                      <a href={pub.permalink} target="_blank" rel="noopener noreferrer">
                        Ver →
                      </a>
                    ) : (
                      <span style={{ color: '#555' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && publicaciones.length === 0 && !error && (
        <div className="empty">No hay publicaciones {statusFilter !== 'active' ? `con estado "${statusFilter}"` : ''} para {viewMode === 'marca' ? marca : 'ninguna marca'}</div>
      )}

      {preview && (
        <img
          src={preview.src}
          alt=""
          className="thumb-preview-float"
          style={{ top: preview.y, left: preview.x }}
        />
      )}

      {/* PREGUNTAS Y RESPUESTAS POR MARCA */}
      {Object.keys(ventasMesMl).length > 0 && (
        <section className="section" style={{ marginTop: '32px' }}>
          <h2 style={{ marginBottom: '8px', textAlign: 'center', color: '#f59e0b' }}>Preguntas & Respuestas</h2>
          <div className="questions-grid">
            {Object.entries(ventasMesMl).map(([marca, data]) => {
              const preg = data.preguntas || { total: 0, sin_responder: 0, tiempo_promedio_horas: 0, tasa_respuesta: 0 }
              return (
                <div key={marca} className="question-card">
                  <div style={{ marginBottom: '12px' }}>
                    {BRAND_LOGOS[marca] ? <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '28px', objectFit: 'contain' }} /> : <h3 style={{ color: '#06b6d4', margin: 0 }}>{marca}</h3>}
                  </div>
                  <div style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
                    <p><strong>Total preguntas:</strong> <span style={{ color: '#06b6d4' }}>{preg.total}</span></p>
                    <p><strong>Sin responder:</strong> <span style={{ color: preg.sin_responder > 10 ? '#ef4444' : '#86efac' }}>{preg.sin_responder}</span> {preg.sin_responder > 10 && '⚠️'}</p>
                    <p><strong>Tiempo promedio:</strong> <span style={{ color: '#86efac' }}>{preg.tiempo_promedio_horas.toFixed(1)}h</span></p>
                    <p><strong>Tasa respuesta:</strong> <span style={{ color: preg.tasa_respuesta >= 90 ? '#86efac' : '#fbbf24' }}>{preg.tasa_respuesta.toFixed(1)}%</span></p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* OPTIMIZACIÓN DE TÍTULOS CON IA */}
      <section className="section" style={{ marginTop: '32px' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', marginBottom: optShowSection ? '16px' : '0' }}
          onClick={() => setOptShowSection(!optShowSection)}
        >
          <h2 style={{ margin: 0, textAlign: 'center', color: '#fff' }}>
            Optimización de Títulos con IA
          </h2>
          <span style={{ color: '#d946ef', fontSize: '1.2em' }}>{optShowSection ? '▼' : '▶'}</span>
        </div>

        {optShowSection && (
          <div style={{ marginTop: '8px' }}>
            {/* Controles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {MARCAS.map(m => (
                  <button
                    key={m}
                    className={`marca-btn ${optMarca === m ? 'active' : ''}`}
                    onClick={() => setOptMarca(m)}
                    style={{ fontSize: '0.8em', padding: '6px 12px' }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <select
                value={optLimit}
                onChange={(e) => setOptLimit(Number(e.target.value))}
                style={{ background: '#1a1a2e', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '6px 10px', fontSize: '0.85em' }}
              >
                <option value={10}>10 publicaciones</option>
                <option value={20}>20 publicaciones</option>
                <option value={30}>30 publicaciones</option>
                <option value={50}>50 publicaciones</option>
              </select>
              <button
                onClick={() => fetchOptimizacion(optMarca, optLimit)}
                disabled={optLoading}
                style={{
                  background: optLoading ? '#555' : 'linear-gradient(135deg, #d946ef, #a855f7)',
                  color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 20px',
                  fontWeight: 700, fontSize: '0.9em', cursor: optLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {optLoading ? 'Analizando con Claude AI...' : 'Analizar Títulos'}
              </button>
            </div>

            {optError && <div className="error" style={{ textAlign: 'center', marginBottom: '12px' }}>{optError}</div>}

            {optLoading && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#d946ef' }}>
                <div style={{ fontSize: '1.5em', marginBottom: '8px' }}>Analizando títulos...</div>
                <div style={{ color: '#7f8c8d', fontSize: '0.9em' }}>Claude AI está evaluando {optLimit} publicaciones de {optMarca}</div>
              </div>
            )}

            {/* Resultados */}
            {!optLoading && optSugerencias.length > 0 && (
              <div>
                {/* Stats */}
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(217,70,239,0.1)', border: '1px solid rgba(217,70,239,0.3)', borderRadius: '10px', padding: '12px 20px', textAlign: 'center' }}>
                    <p style={{ color: '#7f8c8d', fontSize: '0.75em', margin: '0 0 4px' }}>ANALIZADAS</p>
                    <p style={{ color: '#d946ef', fontSize: '1.5em', fontWeight: 800, margin: 0 }}>{optStats?.total || 0}</p>
                  </div>
                  <div style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', borderRadius: '10px', padding: '12px 20px', textAlign: 'center' }}>
                    <p style={{ color: '#7f8c8d', fontSize: '0.75em', margin: '0 0 4px' }}>CON MEJORAS</p>
                    <p style={{ color: '#22d3ee', fontSize: '1.5em', fontWeight: 800, margin: 0 }}>{optStats?.con_cambios || 0}</p>
                  </div>
                  <div style={{ background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.3)', borderRadius: '10px', padding: '12px 20px', textAlign: 'center' }}>
                    <p style={{ color: '#7f8c8d', fontSize: '0.75em', margin: '0 0 4px' }}>APROBADOS</p>
                    <p style={{ color: '#86efac', fontSize: '1.5em', fontWeight: 800, margin: 0 }}>{aprobadosCount}</p>
                  </div>
                </div>

                {/* Acciones masivas */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
                  <button
                    onClick={handleAprobarTodos}
                    style={{
                      background: 'rgba(134,239,172,0.15)', border: '1px solid rgba(134,239,172,0.4)',
                      color: '#86efac', borderRadius: '6px', padding: '6px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85em',
                    }}
                  >
                    {optSugerencias.filter(s => s.tiene_cambio).every(s => optAprobados[s.item_id]) ? 'Desmarcar Todos' : 'Aprobar Todos'}
                  </button>
                  {aprobadosCount > 0 && (
                    <button
                      onClick={handleAplicarAprobados}
                      style={{
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none',
                        color: '#fff', borderRadius: '6px', padding: '6px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85em',
                      }}
                    >
                      Aplicar {aprobadosCount} Aprobados en MeLi
                    </button>
                  )}
                </div>

                {/* Tabla de sugerencias */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="publicaciones-table" style={{ fontSize: '0.85em' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Publicación</th>
                        <th>Título Actual</th>
                        <th>Título Optimizado</th>
                        <th>Cambios</th>
                        <th style={{ width: '80px' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optSugerencias.map(sug => {
                        const aprobado = !!optAprobados[sug.item_id];
                        const estado = optAplicando[sug.item_id];
                        const sinCambio = !sug.tiene_cambio;
                        return (
                          <tr key={sug.item_id} style={{ opacity: sinCambio ? 0.5 : 1 }}>
                            <td style={{ textAlign: 'center' }}>
                              {!sinCambio && (
                                <input
                                  type="checkbox"
                                  checked={aprobado}
                                  onChange={() => handleAprobar(sug.item_id)}
                                  disabled={estado === 'ok' || estado === 'loading'}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#d946ef' }}
                                />
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {sug.thumbnail && <img src={sug.thumbnail} alt="" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />}
                                <div>
                                  <div style={{ color: '#06b6d4', fontSize: '0.8em' }}>{sug.item_id}</div>
                                  <div style={{ color: '#7f8c8d', fontSize: '0.75em' }}>${sug.precio?.toLocaleString()} · {sug.vendidas} vendidas</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ color: sinCambio ? '#7f8c8d' : '#ef4444', maxWidth: '250px' }}>
                              <span style={{ fontSize: '0.9em' }}>{sug.titulo_actual}</span>
                              <span style={{ display: 'block', color: '#555', fontSize: '0.75em' }}>{sug.titulo_actual.length} chars</span>
                            </td>
                            <td style={{ color: sinCambio ? '#7f8c8d' : '#86efac', maxWidth: '250px', fontWeight: sinCambio ? 400 : 600 }}>
                              <span style={{ fontSize: '0.9em' }}>{sug.titulo_optimizado}</span>
                              <span style={{ display: 'block', color: '#555', fontSize: '0.75em' }}>{sug.titulo_optimizado.length} chars</span>
                            </td>
                            <td style={{ color: '#fbbf24', fontSize: '0.8em', maxWidth: '180px' }}>
                              {sinCambio ? <span style={{ color: '#555' }}>Sin cambios</span> : sug.cambios}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {estado === 'loading' && <span style={{ color: '#fbbf24' }}>Aplicando...</span>}
                              {estado === 'ok' && <span style={{ color: '#22c55e', fontWeight: 700 }}>Aplicado</span>}
                              {estado === 'error' && <span style={{ color: '#ef4444' }}>Error</span>}
                              {!estado && !sinCambio && aprobado && (
                                <button
                                  onClick={() => handleAplicarUno(sug.item_id, sug.titulo_optimizado)}
                                  style={{
                                    background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)',
                                    color: '#22c55e', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.8em',
                                  }}
                                >
                                  Aplicar
                                </button>
                              )}
                              {!estado && sinCambio && <span style={{ color: '#555' }}>-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========== HISTORIAL DE TÍTULOS APLICADOS ========== */}
      <section style={{ marginTop: '30px' }}>
        <button
          onClick={() => { setHistorialShow(!historialShow); if (!historialShow && historial.length === 0) fetchHistorial(); }}
          style={{
            background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)',
            color: '#a855f7', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer',
            fontWeight: 700, fontSize: '1em', width: '100%',
          }}
        >
          {historialShow ? 'Ocultar' : 'Ver'} Historial de Títulos Aplicados
        </button>

        {historialShow && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: '#a855f7', fontWeight: 700 }}>
                {historial.length} cambios registrados
              </span>
              <button
                onClick={fetchHistorial}
                disabled={historialLoading}
                style={{
                  background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
                  color: '#a855f7', borderRadius: '6px', padding: '4px 14px', cursor: 'pointer', fontSize: '0.85em',
                }}
              >
                {historialLoading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>

            {historial.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333' }}>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7f8c8d' }}>Fecha</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7f8c8d' }}>Marca</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7f8c8d' }}>Item</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7f8c8d' }}>Título Anterior</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#7f8c8d' }}>Título Nuevo</th>
                      <th style={{ padding: '8px', textAlign: 'center', color: '#7f8c8d' }}>Chars</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #222', opacity: 0.95 }}>
                        <td style={{ padding: '8px', color: '#7f8c8d', whiteSpace: 'nowrap', fontSize: '0.85em' }}>
                          {new Date(h.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                          {' '}
                          {new Date(h.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px', color: '#06b6d4', fontWeight: 600 }}>{h.marca}</td>
                        <td style={{ padding: '8px', color: '#06b6d4', fontSize: '0.8em' }}>{h.item_id}</td>
                        <td style={{ padding: '8px', color: '#ef4444', maxWidth: '220px' }}>
                          <span>{h.titulo_anterior}</span>
                          <span style={{ display: 'block', color: '#555', fontSize: '0.75em' }}>{h.chars_anterior} chars</span>
                        </td>
                        <td style={{ padding: '8px', color: '#86efac', fontWeight: 600, maxWidth: '220px' }}>
                          <span>{h.titulo_nuevo}</span>
                          <span style={{ display: 'block', color: '#555', fontSize: '0.75em' }}>{h.chars_nuevo} chars</span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {h.chars_nuevo > h.chars_anterior
                            ? <span style={{ color: '#22c55e' }}>+{h.chars_nuevo - h.chars_anterior}</span>
                            : h.chars_nuevo < h.chars_anterior
                            ? <span style={{ color: '#ef4444' }}>{h.chars_nuevo - h.chars_anterior}</span>
                            : <span style={{ color: '#555' }}>0</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {historial.length === 0 && !historialLoading && (
              <p style={{ color: '#555', textAlign: 'center', padding: '20px' }}>No hay cambios registrados aún</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
