import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import * as vacantesApi from "../lib/api/vacantesApi";

function textoPublicacion(fechaCreacion) {
  if (!fechaCreacion) return null;

  const publicada = new Date(fechaCreacion);
  if (Number.isNaN(publicada.getTime())) return null;

  const inicioPublicada = new Date(publicada.getFullYear(), publicada.getMonth(), publicada.getDate());
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const dias = Math.round((inicioHoy - inicioPublicada) / 86400000);

  if (dias <= 0) return "Publicado hoy";
  if (dias === 1) return "Publicado hace 1 día";
  return `Publicado hace ${dias} días`;
}

export default function ListaVacantesPage() {
  const [vacantes, setVacantes] = useState(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    vacantesApi
      .listarPublicas()
      .then(setVacantes)
      .catch(() => setError("No se pudieron cargar las vacantes. Intenta de nuevo en un momento."));
  }, []);

  const filtradas = (vacantes || []).filter((v) => {
    if (!busqueda.trim()) return true;
    const texto = `${v.cargo} ${v.descripcion || ""} ${v.procesoNo}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <>
      <DocHeader title="Convocatorias abiertas" />
      <main className="page">
        {error && <div className="card"><div className="notice notice--danger">{error}</div></div>}

        {!error && vacantes === null && <div className="card"><p className="text-muted">Cargando…</p></div>}

        {vacantes && vacantes.length > 0 && (
          <div className="field" style={{ maxWidth: 360, marginBottom: 18 }}>
            <input
              type="text"
              placeholder="Buscar por cargo o palabra clave…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        )}

        {vacantes && vacantes.length === 0 && (
          <div className="card">
            <div className="empty-state">No hay convocatorias abiertas en este momento.</div>
          </div>
        )}

        {vacantes && vacantes.length > 0 && filtradas.length === 0 && (
          <div className="card">
            <div className="empty-state">Ninguna vacante coincide con "{busqueda}".</div>
          </div>
        )}

        {filtradas.length > 0 && (
          <div className="vac-grid">
            {filtradas.map((v) => {
              const publicacion = textoPublicacion(v.fechaCreacion);
              return (
              <div className="vac-card" key={v.id}>
                <div className="vac-card__body">
                  <div className="vac-card__proceso">Proceso {v.procesoNo}</div>
                  <div className="vac-card__cargo">{v.cargo}</div>
                  {v.descripcion && <p className="text-muted" style={{ fontSize: 13, margin: "4px 0 0" }}>{v.descripcion}</p>}
                  <div className="vac-card__meta">
                    <span><b>Sede:</b> {v.sede || "—"}</span>
                    <span><b>Plazas:</b> {v.plazas || "—"}</span>
                    <span><b>Cierra:</b> {v.fechaCierre || "—"} {v.horaCierre || ""}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {publicacion && (
                      <span className="vac-status-pill vac-status-pill--activa vac-card__publicado">
                        {publicacion}
                      </span>
                    )}
                    <span className={`vac-status-pill vac-card__publicado ${v.estaCerrada ? "vac-status-pill--cerrada" : v.aunNoAbre ? "vac-status-pill--oculta" : "vac-status-pill--en-proceso"}`}>
                      {v.estaCerrada ? "Cerrada" : v.aunNoAbre ? `Abre el ${v.fechaApertura}` : "Abierta"}
                    </span>
                  </div>
                </div>
                <div className="vac-card__action">
                  {v.estaCerrada ? (
                    <span className="vac-status-pill vac-status-pill--cerrada">Convocatoria cerrada</span>
                  ) : (
                    <Link to={`/vacante/${v.id}`} className="btn btn-primary">Ver detalles</Link>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}

        <p className="text-center mt-24">
          <Link to="/mis-postulaciones" className="text-muted">Mis postulaciones</Link>
        </p>
      </main>
    </>
  );
}
