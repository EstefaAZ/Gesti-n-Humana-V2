import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import EvaluacionBadge from "../components/EvaluacionBadge";
import { useAuth } from "../context/AuthContext";
import * as solicitudesApi from "../lib/api/solicitudesApi";
import * as vacantesApi from "../lib/api/vacantesApi";

export default function MisPostulacionesPage() {
  const { token } = useAuth();
  const [postulaciones, setPostulaciones] = useState(null);
  const [vacantesPorId, setVacantesPorId] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const lista = await solicitudesApi.misSolicitudes(token);
        setPostulaciones(lista);
        const entradas = await Promise.all(
          lista.map(async (p) => {
            try {
              return [p.vacanteId, await vacantesApi.obtenerPublica(p.vacanteId)];
            } catch {
              return [p.vacanteId, null];
            }
          })
        );
        setVacantesPorId(Object.fromEntries(entradas));
      } catch {
        setError("No se pudieron cargar tus postulaciones.");
      }
    })();
  }, [token]);

  async function eliminarPostulacion(radicado) {
    if (!window.confirm("¿Eliminar por completo esta postulación? Esta acción no se puede deshacer.")) return;
    try {
      await solicitudesApi.eliminar(radicado, token);
      setPostulaciones((prev) => prev.filter((p) => p.radicado !== radicado));
    } catch {
      alert("No se pudo eliminar la postulación. Si ya fue aceptada, contacta a Gestión Humana.");
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
                <tr><th>Vacante</th><th>Radicado</th><th>Estado</th><th>Evaluación</th><th></th></tr>
              </thead>
              <tbody>
                {postulaciones.map((p) => (
                  <tr key={p.radicado}>
                    <td>{vacantesPorId[p.vacanteId]?.cargo || p.vacanteId}</td>
                    <td className="mono" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{p.radicado}</td>
                    <td>{p.estado}</td>
                    <td><EvaluacionBadge evaluacion={p.evaluacion} mostrarMotivos={false} /></td>
                    <td>
                      <button className="hr-link-btn" onClick={() => solicitudesApi.descargarPdf(p.radicado, token)}>
                        Descargar PDF
                      </button>
                      {" · "}
                      <button className="hr-link-btn hr-link-btn--danger" onClick={() => eliminarPostulacion(p.radicado)}>
                        Eliminar
                      </button>
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
