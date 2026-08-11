import { useEffect, useState } from "react";
import EvaluacionBadge from "../../components/EvaluacionBadge";
import EstadoPostulacionBadge from "../../components/EstadoPostulacionBadge";
import PostulacionDetalle from "./PostulacionDetalle";
import { useAuth } from "../../context/AuthContext";
import * as solicitudesApi from "../../lib/api/solicitudesApi";

const ETIQUETA_ESTADO = {
  borrador: "Borrador",
  publicada: "Publicada",
  en_proceso: "En proceso",
  cerrada: "Cerrada",
  cancelada_desierta: "Cancelada/Desierta",
};
const CLASE_ESTADO = {
  borrador: "vac-status-pill--oculta",
  publicada: "vac-status-pill--activa",
  en_proceso: "vac-status-pill--en-proceso",
  cerrada: "vac-status-pill--cerrada",
  cancelada_desierta: "vac-status-pill--cancelada",
};

export default function VacanteDetalleGestion({ vacante, conteo, onVolver, onCambiarEstado, onEditar, onCopiarEnlace, onDescargarReporte, onEliminar, enlaceCopiado }) {
  const { token } = useAuth();
  const [postulaciones, setPostulaciones] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [error, setError] = useState("");
  const [editandoEstado, setEditandoEstado] = useState(false);

  function cargarPostulaciones() {
    solicitudesApi
      .listarPorVacante(vacante.id, token)
      .then((lista) => {
        lista.sort((a, b) => (a.evaluacion?.cumple ? 0 : 1) - (b.evaluacion?.cumple ? 0 : 1));
        setPostulaciones(lista);
      })
      .catch(() => setError("No se pudieron cargar las postulaciones."));
  }

  useEffect(() => {
    cargarPostulaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacante.id]);

  const detalle = (postulaciones || []).find((p) => p.radicado === detalleId);
  const c = vacante.criterios || {};

  return (
    <div>
      <button type="button" className="hr-link-btn" onClick={onVolver} style={{ marginBottom: 16 }}>← Volver a Vacantes</button>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="hr-table-actions" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-muted)" }}>{vacante.procesoNo}</span>
            <h2 className="section-title" style={{ margin: "2px 0 0" }}>{vacante.cargo}</h2>
          </div>
          {editandoEstado ? (
            <select
              autoFocus
              value={vacante.estado}
              onChange={(e) => { onCambiarEstado(vacante, e.target.value); setEditandoEstado(false); }}
              onBlur={() => setEditandoEstado(false)}
              className="vac-status-select"
            >
              {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>
          ) : (
            <span
              className={`vac-status-pill ${CLASE_ESTADO[vacante.estado] || ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => setEditandoEstado(true)}
              title="Clic para cambiar el estado"
            >
              {ETIQUETA_ESTADO[vacante.estado]}
            </span>
          )}
        </div>

        {vacante.descripcion && <p className="text-muted" style={{ fontSize: 13.5, marginBottom: 14 }}>{vacante.descripcion}</p>}

        <div className="field-grid" style={{ marginBottom: 14 }}>
          <div className="info-box"><label>Sede</label><div className="value">{vacante.sede || "—"}</div></div>
          <div className="info-box"><label>Salario</label><div className="value">{vacante.salario || "—"}</div></div>
          <div className="info-box"><label>Cierre</label><div className="value">{vacante.fechaCierre || "—"} {vacante.horaCierre || ""}</div></div>
          <div className="info-box"><label>Postulaciones</label><div className="value">{conteo[vacante.id] || 0}</div></div>
        </div>

        {(c.nivelEducativoMin || c.experienciaMinAnios || c.idiomaRequerido || (c.certificacionesKeywords || []).length > 0) && (
          <ul style={{ margin: "0 0 14px 18px", padding: 0, fontSize: 12.5, color: "var(--color-text-muted)" }}>
            {c.nivelEducativoMin && <li>Nivel educativo mínimo: {c.nivelEducativoMin}{c.graduadoRequerido ? " (graduado)" : ""}</li>}
            {c.experienciaMinAnios && <li>Experiencia mínima: {c.experienciaMinAnios} años</li>}
            {c.idiomaRequerido && <li>Idioma: {c.idiomaRequerido} — mínimo {c.idiomaNivelMin} ({c.idiomaHabilidad})</li>}
            {(c.certificacionesKeywords || []).map((cert, i) => <li key={i}>Certificación: "{cert}"</li>)}
          </ul>
        )}

        <div className="hr-table-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDescargarReporte(vacante)}>Descargar reporte</button>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title" style={{ fontSize: 15, marginBottom: 14 }}>Candidatos postulados</h3>
        {error && <div className="notice notice--danger">{error}</div>}

        {postulaciones === null && !error && <p className="text-muted">Cargando…</p>}

        {postulaciones && postulaciones.length === 0 && (
          <div className="empty-state">Aún no hay postulaciones para esta vacante.</div>
        )}

        {postulaciones && postulaciones.length > 0 && (
          <table className="plain-table">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "34%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr><th>Aspirante</th><th>Celular</th><th>Recibido</th><th>Estado</th><th>Evaluación</th><th></th></tr>
            </thead>
            <tbody>
              {postulaciones.map((p) => (
                <tr key={p.radicado}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {p.datosPersonales?.nombreCompleto}
                    <br /><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>C.C. {p.datosPersonales?.cedula}</span>
                  </td>
                  <td>{p.datosPersonales?.celular}</td>
                  <td>{new Date(p.fechaSolicitud).toLocaleString("es-CO")}</td>
                  <td><EstadoPostulacionBadge estado={p.estado} /></td>
                  <td><EvaluacionBadge evaluacion={p.evaluacion} /></td>
                  <td><button className="hr-link-btn" onClick={() => setDetalleId(p.radicado)}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detalle && (
        <PostulacionDetalle solicitud={detalle} onCerrar={() => setDetalleId(null)} onCambioEstado={cargarPostulaciones} />
      )}
    </div>
  );
}