import { useState } from "react";
import EvaluacionBadge from "../../components/EvaluacionBadge";
import { useAuth } from "../../context/AuthContext";
import * as solicitudesApi from "../../lib/api/solicitudesApi";
import { CATEGORIAS_DOCUMENTOS } from "../../lib/api/solicitudesApi";

const ESTADOS = ["Recibida", "En revisión", "Preseleccionado", "Entrevista programada", "Rechazada", "Aceptada"];

function tablaSimple(arr, campos, labels) {
  if (!arr || arr.length === 0) return <p className="text-muted" style={{ fontSize: 12.5 }}>Sin registros.</p>;
  return (
    <table className="plain-table">
      <thead><tr>{labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
      <tbody>
        {arr.map((row, i) => (
          <tr key={i}>{campos.map((c) => <td key={c}>{row[c] ?? "—"}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PostulacionDetalle({ solicitud, onCerrar, onCambioEstado }) {
  const { token } = useAuth();
  const dp = solicitud.datosPersonales || {};
  const [estado, setEstado] = useState(solicitud.estado);
  const [nuevoEstado, setNuevoEstado] = useState(solicitud.estado);
  const [guardando, setGuardando] = useState(false);

  async function guardarEstado() {
    setGuardando(true);
    try {
      const actualizada = await solicitudesApi.cambiarEstado(solicitud.radicado, nuevoEstado, token);
      setEstado(actualizada.estado);
      onCambioEstado?.();
    } catch {
      alert("No se pudo actualizar el estado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card mt-24">
      <div className="wizard-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
        <h2 className="section-title" style={{ margin: 0 }}>{dp.nombreCompleto}</h2>
        <div className="hr-table-actions">
          <button type="button" className="btn btn-secondary" onClick={() => solicitudesApi.descargarPdf(solicitud.radicado, token)}>Descargar PDF</button>
          <button type="button" className="hr-link-btn" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>

      <p className="text-muted">Radicado: <strong>{solicitud.radicado}</strong> · Cédula: {dp.cedula} · Correo: {dp.correo} · Celular: {dp.celular}</p>

      <EvaluacionBadge evaluacion={solicitud.evaluacion} />

      <div className="notice notice--info" style={{ marginTop: 16 }}>
        <strong>Estado actual: {estado}</strong>
        <div className="field-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="field">
            <button type="button" className="btn btn-secondary" onClick={guardarEstado} disabled={guardando || nuevoEstado === estado}>
              {guardando ? "Guardando…" : "Actualizar estado"}
            </button>
          </div>
        </div>
      </div>

      <h3 className="section-title" style={{ fontSize: 14, marginTop: 20 }}>Datos personales</h3>
      <p style={{ fontSize: 13 }}>
        Residencia: {dp.direccion}, {dp.municipio}, {dp.deptoResidencia}<br />
        Profesión: {dp.profesion || "—"}<br />
        Estado civil: {dp.estadoCivil}
      </p>

      <h3 className="section-title" style={{ fontSize: 14 }}>Estudios, cursos, certificaciones e idiomas</h3>
      {tablaSimple(
        (solicitud.registrosII || []).map((r) => ({
          tipo: r.tipoLabel,
          detalle: r.titulo || r.nombreEvento || r.nombreNorma || r.idioma || "—",
          establecimiento: r.establecimiento || r.enteCertificador || "—",
        })),
        ["tipo", "detalle", "establecimiento"],
        ["Tipo", "Detalle", "Establecimiento/Ente"]
      )}

      <h3 className="section-title" style={{ fontSize: 14 }}>Experiencia laboral</h3>
      {tablaSimple(solicitud.experiencia, ["empresa", "cargo", "tiempoLaborado", "dedicacion"], ["Empresa", "Cargo", "Tiempo", "Dedicación"])}

      <h3 className="section-title" style={{ fontSize: 14 }}>Conflicto de interés</h3>
      {solicitud.conflicto?.tieneVinculo === "si"
        ? tablaSimple(solicitud.conflicto.familiares, ["parentesco", "nombreEmpleado", "cargo"], ["Parentesco", "Nombre", "Cargo"])
        : <p className="text-muted" style={{ fontSize: 12.5 }}>No declaró vínculos.</p>}

      <h3 className="section-title" style={{ fontSize: 14 }}>Documentos adjuntos</h3>
      {CATEGORIAS_DOCUMENTOS.map((cat) => {
        const archivos = solicitud.documentosAdjuntos?.[cat.clave] || [];
        return (
          <div key={cat.clave} style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{cat.etiqueta}: </span>
            {archivos.length === 0 ? (
              <span className="text-muted" style={{ fontSize: 12.5 }}>sin adjuntar</span>
            ) : (
              archivos.map((doc, i) => (
                <button
                  key={i}
                  type="button"
                  className="hr-link-btn"
                  style={{ marginRight: 10 }}
                  onClick={() => solicitudesApi.descargarDocumentoAdjunto(solicitud.radicado, cat.claveApi, i, doc.nombre, token)}
                >
                  📄 {doc.nombre}
                </button>
              ))
            )}
          </div>
        );
      })}

      <h3 className="section-title" style={{ fontSize: 14 }}>Autorización</h3>
      <p style={{ fontSize: 13 }}>{solicitud.autorizacion?.nombreCompleto} — {new Date(solicitud.fechaSolicitud).toLocaleString("es-CO")}</p>
    </div>
  );
}
