import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './PublicacionesTab.css';

const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && text && (
        <span style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a2e', color: '#fff', padding: '8px 12px', borderRadius: '6px',
          fontSize: '1.1em', fontWeight: 400, lineHeight: '1.4', whiteSpace: 'normal',
          width: '340px', zIndex: 100, border: '1px solid #333', marginBottom: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)', pointerEvents: 'none',
        }}>{text}</span>
      )}
    </span>
  );
};

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
      <KpiCard label="Stock Total" value={kpis.stock_total?.toLocaleString('es-AR')} color="#d946ef" />
      <KpiCard label="Vendidas Total" value={kpis.vendidas_total?.toLocaleString('es-AR')} color="#f59e0b" />
      <KpiCard label="Precio Promedio" value={`$${kpis.precio_promedio?.toLocaleString('es-AR')}`} color="#86efac" />
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



  // --- Estado para Preguntas sin responder ---
  const [preguntasData, setPreguntasData] = useState({});
  const [preguntasLoading, setPreguntasLoading] = useState(false);

  // --- Listado colapsado ---
  const [listadoOpen, setListadoOpen] = useState(false);

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

  const [optErrores, setOptErrores] = useState({}); // item_id -> error message

  const handleAplicarUno = async (itemId, nuevoTitulo) => {
    setOptAplicando(prev => ({ ...prev, [itemId]: 'loading' }));
    setOptErrores(prev => ({ ...prev, [itemId]: null }));
    try {
      const resp = await fetch('/api/titulos/aplicar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, nuevo_titulo: nuevoTitulo, marca: optMarca }),
      });
      if (resp.status === 200 || resp.status === 201) {
        setOptAplicando(prev => ({ ...prev, [itemId]: 'ok' }));
      } else {
        const text = await resp.text();
        let errMsg = text.slice(0, 150);
        try { errMsg = JSON.parse(text).detail || errMsg; } catch {}
        setOptAplicando(prev => ({ ...prev, [itemId]: 'error' }));
        setOptErrores(prev => ({ ...prev, [itemId]: errMsg }));
        console.error('Error aplicando título:', errMsg);
      }
    } catch (e) {
      setOptAplicando(prev => ({ ...prev, [itemId]: 'error' }));
      setOptErrores(prev => ({ ...prev, [itemId]: e.message }));
    }
  };

  const handleAplicarAprobados = async () => {
    const aprobados = optSugerencias.filter(s => optAprobados[s.item_id] && s.tiene_cambio);
    for (const s of aprobados) {
      await handleAplicarUno(s.item_id, s.titulo_optimizado);
    }
  };

  const aprobadosCount = Object.values(optAprobados).filter(Boolean).length;


  useEffect(() => {
    if (viewMode === 'marca') {
      fetchReporteMarca(marca, statusFilter);
    } else {
      fetchReporteTodas(statusFilter);
    }
  }, [marca, statusFilter, viewMode]);

  // Fetch preguntas sin responder
  useEffect(() => {
    setPreguntasLoading(true);
    fetch('/api/publicaciones/preguntas-sin-responder')
      .then(r => r.json())
      .then(data => setPreguntasData(data))
      .catch(err => console.error('Error fetching preguntas:', err))
      .finally(() => setPreguntasLoading(false));
  }, []);

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

  const downloadExcel = () => {
    const pubs = getFilteredPublicaciones();
    const rows = pubs.map(pub => {
      const row = {};
      if (viewMode === 'todas') row['Marca'] = pub.marca;
      row['Título'] = cleanTitle(pub.titulo);
      row['Estado'] = pub.status_label;
      row['Precio'] = pub.precio;
      row['Salud'] = pub.health != null ? `${Math.round(pub.health * 100)}%` : '-';
      row['Stock'] = pub.stock;
      row['Vendidas'] = pub.vendidas;
      row['Tipo'] = pub.listing_type_label;
      row['Envío'] = pub.logistica_full ? 'FULL' : pub.envio_gratis ? 'Gratis' : 'Pago';
      row['Condición'] = pub.condition_label;
      row['Fotos'] = pub.fotos;
      row['Días'] = pub.dias_publicado ?? '-';
      row['Link'] = pub.permalink || '';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map(key => {
      const maxLen = Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length));
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    const sheetName = viewMode === 'todas' ? 'Todas las Marcas' : marca;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fileName = viewMode === 'todas'
      ? `Publicaciones_Todas_${statusFilter}.xlsx`
      : `Publicaciones_${marca}_${statusFilter}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <h2 style={{ margin: 0 }}>Reporte de Publicaciones</h2>
        {publicaciones.length > 0 && (
          <button onClick={downloadExcel} className="download-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
              <path d="M8 1v9m0 0L5 7m3 3l3-3M2 12v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Descargar Excel
          </button>
        )}
      </div>

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
                <span style={{ color: '#d946ef' }}>{mk.stock_total?.toLocaleString('es-AR')} stock</span>
                <span className="sep">|</span>
                <span style={{ color: '#f59e0b' }}>{mk.vendidas_total?.toLocaleString('es-AR')} vendidas</span>
                <span className="sep">|</span>
                <span style={{ color: '#86efac' }}>${(mk.valor_stock_estimado / 1000000).toFixed(1)}M</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logo + KPIs (siempre visibles) + Tabla colapsable */}
      {!loading && publicaciones.length > 0 && (
        <div className="publicaciones-grid">
          {viewMode === 'marca' && BRAND_LOGOS[marca] && (
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <img src={BRAND_LOGOS[marca]} alt={marca} style={{ height: '58px', maxWidth: '240px', objectFit: 'contain' }} />
            </div>
          )}
          {/* KPIs debajo del logo */}
          {!loading && kpis && <KpisSection kpis={kpis} />}

          {/* Toggle listado */}
          <div
            onClick={() => setListadoOpen(!listadoOpen)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', margin: '12px 0 8px', padding: '10px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }}
          >
            <h2 style={{ margin: 0, fontSize: '1em', fontWeight: 400, color: '#fff' }}>
              {listadoOpen ? '▼' : '▶'} Listado de Publicaciones ({publicaciones.length})
            </h2>
          </div>

          {listadoOpen && (
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
                    ${pub.precio?.toLocaleString('es-AR')}
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
          )}
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

      {/* PREGUNTAS SIN RESPONDER (últimos 15 días) */}
      <section className="section" style={{ marginTop: '32px' }}>
        <h2 style={{ marginBottom: '16px', textAlign: 'center', color: '#f59e0b' }}>
          Preguntas Sin Responder
          <span style={{ fontSize: '0.6em', color: '#888', marginLeft: '8px' }}>(últimos 15 días)</span>
        </h2>
        {preguntasLoading ? (
          <p style={{ textAlign: 'center', color: '#888' }}>Cargando preguntas...</p>
        ) : Object.keys(preguntasData).length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>No hay datos de preguntas</p>
        ) : (
          <div className="questions-grid">
            {Object.entries(preguntasData).map(([brandKey, brandData]) => {
              const preguntas = brandData.preguntas || [];
              const count = brandData.sin_responder || 0;
              const brandMl = ventasMesMl[brandKey] || {};
              const tiempoPromedio = brandMl.preguntas?.tiempo_promedio_horas;
              return (
                <div key={brandKey} className="question-card">
                  <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {BRAND_LOGOS[brandKey]
                      ? <img src={BRAND_LOGOS[brandKey]} alt={brandKey} style={{ height: '28px', objectFit: 'contain' }} />
                      : <h3 style={{ color: '#06b6d4', margin: 0 }}>{brandKey}</h3>}
                    <span style={{
                      background: count > 10 ? 'rgba(239,68,68,0.2)' : count > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(134,239,172,0.2)',
                      color: count > 10 ? '#ef4444' : count > 0 ? '#fbbf24' : '#86efac',
                      padding: '2px 10px', borderRadius: '12px', fontSize: '0.85em', fontWeight: 600
                    }}>
                      {count} sin responder
                    </span>
                  </div>
                  {preguntas.length === 0 ? (
                    <p style={{ color: '#86efac', fontSize: '0.85em', textAlign: 'center' }}>Sin preguntas pendientes</p>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '0.82em' }}>
                      {preguntas.map((q, idx) => (
                        <div key={q.id || idx} style={{
                          padding: '8px 0',
                          borderBottom: idx < preguntas.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'
                        }}>
                          <p style={{ margin: '0 0 4px 0', color: '#e2e8f0', lineHeight: '1.4' }}>"{q.text}"</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {q.item_title ? (
                              <a
                                href={q.item_permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#06b6d4', fontSize: '0.9em', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}
                                title={q.item_title}
                              >
                                {q.item_title.length > 35 ? q.item_title.slice(0, 35) + '…' : q.item_title}
                              </a>
                            ) : (
                              <span style={{ color: '#666', fontSize: '0.9em' }}>{q.item_id}</span>
                            )}
                            <span style={{ color: '#666', fontSize: '0.85em', whiteSpace: 'nowrap' }}>
                              {q.date_created ? new Date(q.date_created).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tiempoPromedio != null && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.82em', textAlign: 'center', color: '#888' }}>
                      Tiempo promedio de respuesta: <span style={{ color: tiempoPromedio <= 2 ? '#86efac' : tiempoPromedio <= 5 ? '#fbbf24' : '#ef4444', fontWeight: 600 }}>{tiempoPromedio.toFixed(1)}h</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

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
                </div>

                {/* Tabla de sugerencias */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="publicaciones-table" style={{ fontSize: '0.85em' }}>
                    <thead>
                      <tr>
                        <th>Publicación</th>
                        <th>Título Actual</th>
                        <th>Título Optimizado</th>
                        <th style={{ width: '80px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {optSugerencias.map(sug => {
                        const sinCambio = !sug.tiene_cambio;
                        const copiado = optAplicando[sug.item_id] === 'copiado';
                        return (
                          <tr key={sug.item_id} style={{ opacity: sinCambio ? 0.5 : 1 }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {sug.thumbnail && <img src={sug.thumbnail} alt="" style={{ width: '52px', height: '52px', borderRadius: '6px', objectFit: 'cover' }} />}
                                <div>
                                  <div style={{ color: '#06b6d4', fontSize: '0.8em' }}>
                                    {sug.permalink ? (
                                      <a href={sug.permalink} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', textDecoration: 'none' }}>
                                        {sug.item_id} ↗
                                      </a>
                                    ) : sug.item_id}
                                  </div>
                                  <div style={{ color: '#7f8c8d', fontSize: '0.75em' }}>${sug.precio?.toLocaleString('es-AR')} · {sug.vendidas} vendidas</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ color: sinCambio ? '#7f8c8d' : '#ef4444', maxWidth: '250px' }}>
                              <span style={{ fontSize: '0.9em' }}>{sug.titulo_actual}</span>
                              <span style={{ display: 'block', color: '#555', fontSize: '0.75em' }}>{sug.titulo_actual.length} chars</span>
                            </td>
                            <td style={{ maxWidth: '280px' }}>
                              {sinCambio ? (
                                <span style={{ fontSize: '0.9em', color: '#7f8c8d' }}>{sug.titulo_optimizado}</span>
                              ) : (
                                <Tooltip text={sug.cambios}>
                                  <span style={{ fontSize: '0.9em', color: '#fff', fontWeight: 600, cursor: 'help', borderBottom: '1px dotted #555' }}>
                                    {sug.titulo_optimizado}
                                  </span>
                                </Tooltip>
                              )}
                              <span style={{ display: 'block', color: '#555', fontSize: '0.75em' }}>{sug.titulo_optimizado.length} chars</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {!sinCambio && (
                                copiado ? (
                                  <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.8em' }}>Copiado</span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(sug.titulo_optimizado);
                                      setOptAplicando(prev => ({ ...prev, [sug.item_id]: 'copiado' }));
                                      setTimeout(() => setOptAplicando(prev => ({ ...prev, [sug.item_id]: null })), 2000);
                                    }}
                                    style={{
                                      background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)',
                                      color: '#22d3ee', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8em', fontWeight: 600,
                                    }}
                                  >
                                    Copiar
                                  </button>
                                )
                              )}
                              {sinCambio && <span style={{ color: '#555', fontSize: '0.75em' }}>Sin cambios</span>}
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

    </div>
  );
}
