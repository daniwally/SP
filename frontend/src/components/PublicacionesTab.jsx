import React, { useState, useEffect } from 'react';
import './PublicacionesTab.css';

const MARCAS = ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND', 'URBAN_FLOW'];

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
      <KpiCard label="Logística Full" value={`${kpis.con_full}`} sub={`${kpis.pct_full}%`} color="#3b82f6" />
      <KpiCard label="Con Descuento" value={kpis.con_descuento} color="#ef4444" />
      <KpiCard label="Valor Stock" value={`$${(kpis.valor_stock_estimado / 1000000).toFixed(1)}M`} color="#d946ef" />
    </div>
  );
}

export default function PublicacionesTab() {
  const [marca, setMarca] = useState('SHAQ');
  const [statusFilter, setStatusFilter] = useState('active');
  const [viewMode, setViewMode] = useState('marca'); // 'marca' or 'todas'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('vendidas');
  const [sortDir, setSortDir] = useState('desc');
  const [searchText, setSearchText] = useState('');

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

      {/* KPIs */}
      {!loading && kpis && <KpisSection kpis={kpis} />}

      {/* KPIs por marca (en vista "todas") */}
      {!loading && viewMode === 'todas' && data?.kpis_por_marca && (
        <div className="marca-kpis-row">
          {Object.entries(data.kpis_por_marca).map(([m, mk]) => (
            <div key={m} className="marca-kpi-card">
              <h4>{m}</h4>
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
          <div className="table-info">
            <span>{publicaciones.length} publicaciones</span>
          </div>
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
                      <img src={pub.thumbnail} alt="" className="thumb" />
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
    </div>
  );
}
