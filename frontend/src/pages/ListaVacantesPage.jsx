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

  useEffect(() => {
    vacantesApi
      .listarPublicas()
      .then(setVacantes)
      .catch(() => setError("No se pudieron cargar las vacantes. Intenta de nuevo en un momento."));
  }, []);

  return (
    <>
      <DocHeader title="Convocatorias abiertas" />
      <main className="page">
        {error && <div className="card"><div className="notice notice--danger">{error}</div></div>}

        {!error && vacantes === null && <div className="card"><p className="text-muted">Cargando…</p></div>}

        {vacantes && vacantes.length === 0 && (
          <div className="card">
            <div className="empty-state">No hay convocatorias abiertas en este momento.</div>
          </div>
        )}

        {vacantes && vacantes.length > 0 && (
          <div className="vac-grid">
            {vacantes.map((v) => {
              const publicacion = textoPublicacion(v.fechaCreacion);
              return (
              <div className="vac-card" key={v.id}>
                <div className="vac-card__body">
                  <div className="vac-card__proceso">Proceso {v.procesoNo}</div>
                  <div className="vac-card__cargo">{v.cargo}</div>
                  <div className="vac-card__meta">
                    <span><b>Sede:</b> {v.sede || "—"}</span>
                    <span><b>Plazas:</b> {v.plazas || "—"}</span>
                    <span><b>Cierra:</b> {v.fechaCierre || "—"} {v.horaCierre || ""}</span>
                  </div>
                  {publicacion && (
                    <span className="vac-status-pill vac-status-pill--activa vac-card__publicado">
                      {publicacion}
                    </span>
                  )}
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
