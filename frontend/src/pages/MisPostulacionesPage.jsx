import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import EstadoPostulacionBadge from "../components/EstadoPostulacionBadge";
import { useAuth } from "../context/AuthContext";
import * as solicitudesApi from "../lib/api/solicitudesApi";

export default function MisPostulacionesPage() {
  const { token } = useAuth();
  const [postulaciones, setPostulaciones] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    solicitudesApi
      .misSolicitudes(token)
      .then(setPostulaciones)
      .catch(() => setError("No se pudieron cargar tus postulaciones."));
  }, [token]);

  async function retirarPostulacion(radicado) {
    if (!window.confirm("¿Retirarte de este proceso de selección? Tus datos se conservan, solo queda marcado que ya no sigues en el proceso.")) return;
    try {
      const actualizada = await solicitudesApi.retirar(radicado, token);
      setPostulaciones((prev) => prev.map((p) => (p.radicado === radicado ? actualizada : p)));
    } catch (e) {
      alert(e.detail || "No se pudo retirar la postulación.");
    }
  }

  return (
    <>
      <DocHeader title="Mis postulaciones" />
      <main className="page">
        <div className="card">
          {error && <div className="notice notice--danger">{error}</div>}

          {postulaciones === null && !error && <p className="text-muted">Cargando…</p>}

          {postulaciones && postulaciones.length === 0 && (
            <div className="empty-state">Aún no tienes postulaciones. <Link to="/">Ver vacantes abiertas</Link>.</div>
          )}

          {postulaciones && postulaciones.length > 0 && (
            <table className="plain-table">
              <thead>
                <tr><th>Vacante</th><th>Radicado</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {postulaciones.map((p) => (
                  <tr key={p.radicado}>
                    <td>{p.vacanteCargo || p.vacanteId}</td>
                    <td className="mono" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{p.radicado}</td>
                    <td><EstadoPostulacionBadge estado={p.estado} /></td>
                    <td>
                      <button className="hr-link-btn" onClick={() => solicitudesApi.descargarPdf(p.radicado, token)}>
                        Descargar PDF
                      </button>
                      {p.estado !== "Retirada" && p.estado !== "Aceptada" && (
                        <>
                          {" · "}
                          <button className="hr-link-btn hr-link-btn--danger" onClick={() => retirarPostulacion(p.radicado)}>
                            Retirar postulación
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
