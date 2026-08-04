import { useEffect, useState } from "react";
import EvaluacionBadge from "../../components/EvaluacionBadge";
import PostulacionDetalle from "./PostulacionDetalle";
import { useAuth } from "../../context/AuthContext";
import * as vacantesApi from "../../lib/api/vacantesApi";
import * as solicitudesApi from "../../lib/api/solicitudesApi";

export default function PostulacionesTab() {
  const { token } = useAuth();
  const [vacantes, setVacantes] = useState([]);
  const [vacanteId, setVacanteId] = useState("");
  const [postulaciones, setPostulaciones] = useState([]);
  const [detalleId, setDetalleId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    vacantesApi.listarAdmin(token).then(setVacantes).catch(() => setError("No se pudieron cargar las vacantes."));
  }, [token]);

  useEffect(() => {
    if (!vacanteId) {
      setPostulaciones([]);
      setDetalleId(null);
      return;
    }
    solicitudesApi
      .listarPorVacante(vacanteId, token)
      .then((lista) => {
        // Prioriza mostrando primero quienes cumplen los criterios (solo orden, no filtro).
        lista.sort((a, b) => (a.evaluacion?.cumple ? 0 : 1) - (b.evaluacion?.cumple ? 0 : 1));
        setPostulaciones(lista);
      })
      .catch(() => setError("No se pudieron cargar las postulaciones."));
    setDetalleId(null);
  }, [vacanteId, token]);

  const detalle = postulaciones.find((p) => p.radicado === detalleId);

  if (vacantes.length === 0) {
    return <div className="card"><div className="empty-state">Crea primero una vacante para ver postulaciones.</div></div>;
  }

  return (
    <>
      <div className="card">
        {error && <div className="notice notice--danger">{error}</div>}
        <div className="field" style={{ maxWidth: 420 }}>
          <label>Vacante</label>
          <select value={vacanteId} onChange={(e) => setVacanteId(e.target.value)}>
            <option value="">Selecciona una vacante…</option>
            {vacantes.map((v) => (
              <option key={v.id} value={v.id}>{v.procesoNo} — {v.cargo}</option>
            ))}
          </select>
        </div>

        {!vacanteId && <div className="empty-state">Selecciona una vacante para ver sus postulaciones.</div>}

        {vacanteId && postulaciones.length === 0 && (
          <div className="empty-state">Aún no hay postulaciones para esta vacante.</div>
        )}

        {vacanteId && postulaciones.length > 0 && (
          <table className="plain-table">
            <thead>
              <tr><th>Aspirante</th><th>Contacto</th><th>Recibido</th><th>Evaluación</th><th></th></tr>
            </thead>
            <tbody>
              {postulaciones.map((p) => (
                <tr key={p.radicado}>
                  <td>
                    {p.datosPersonales?.nombreCompleto}
                    <br /><span className="mono" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>C.C. {p.datosPersonales?.cedula}</span>
                  </td>
                  <td>{p.datosPersonales?.correo}<br />{p.datosPersonales?.celular}</td>
                  <td>{new Date(p.fechaSolicitud).toLocaleString("es-CO")}</td>
                  <td><EvaluacionBadge evaluacion={p.evaluacion} /></td>
                  <td><button className="hr-link-btn" onClick={() => setDetalleId(p.radicado)}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detalle && <PostulacionDetalle solicitud={detalle} onCerrar={() => setDetalleId(null)} onCambioEstado={() => solicitudesApi.listarPorVacante(vacanteId, token).then(setPostulaciones)} />}
    </>
  );
}
