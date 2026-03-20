import React, { useState, useEffect } from 'react';
import './PublicacionesTab.css';

export default function PublicacionesTab() {
  const [marca, setMarca] = useState('SHAQ');
  const [publicaciones, setPublicaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const marcas = ['SHAQ', 'STARTER', 'HYDRATE', 'TIMBERLAND', 'URBAN_FLOW'];

  useEffect(() => {
    fetchPublicaciones(marca);
  }, [marca]);

  const fetchPublicaciones = async (selectedMarca) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/publicaciones/por-marca/${selectedMarca}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setPublicaciones([]);
      } else {
        setPublicaciones(data.publicaciones || []);
      }
    } catch (err) {
      setError(`Error cargando publicaciones: ${err.message}`);
      setPublicaciones([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="publicaciones-container">
      <h2>📋 Publicaciones</h2>
      
      <div className="marca-selector">
        {marcas.map(m => (
          <button 
            key={m}
            className={`marca-btn ${marca === m ? 'active' : ''}`}
            onClick={() => setMarca(m)}
          >
            {m}
          </button>
        ))}
      </div>

      {loading && <div className="loading">Cargando...</div>}
      {error && <div className="error">{error}</div>}

      {publicaciones.length > 0 ? (
        <div className="publicaciones-grid">
          <table className="publicaciones-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Vendidas</th>
                <th>Tipo</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {publicaciones.map(pub => (
                <tr key={pub.item_id}>
                  <td className="titulo">{pub.titulo}</td>
                  <td className="precio">${pub.precio.toLocaleString()}</td>
                  <td className="stock">{pub.stock}</td>
                  <td className="vendidas">{pub.vendidas}</td>
                  <td className="tipo">{pub.listing_type}</td>
                  <td>
                    <a href={pub.url} target="_blank" rel="noopener noreferrer">
                      Ver en ML →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && <div className="empty">No hay publicaciones para {marca}</div>
      )}

      <div className="stats">
        <p>Total de publicaciones: {publicaciones.length}</p>
        <p>Stock total: {publicaciones.reduce((acc, pub) => acc + pub.stock, 0)}</p>
        <p>Vendidas totales: {publicaciones.reduce((acc, pub) => acc + pub.vendidas, 0)}</p>
      </div>
    </div>
  );
}
