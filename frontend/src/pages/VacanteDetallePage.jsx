import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import * as vacantesApi from "../lib/api/vacantesApi";
import * as solicitudesApi from "../lib/api/solicitudesApi";
import { useAuth } from "../context/AuthContext";

export default function VacanteDetallePage() {
  const { id } = useParams();
  const { token, usuario } = useAuth();
  const [vacante, setVacante] = useState(undefined); // undefined = cargando, null = no encontrada
  const [error, setError] = useState("");
  const [miPostulacion, setMiPostulacion] = useState(undefined); // undefined = cargando, null = no se ha postulado

  useEffect(() => {
    vacantesApi
      .obtenerPublica(id)
      .then(setVacante)
      .catch((e) => (e.status === 404 ? setVacante(null) : setError("No se pudo cargar la vacante.")));
  }, [id]);

  useEffect(() => {
    if (!token) return;
    solicitudesApi
      .misSolicitudes(token)
      .then((mias) => setMiPostulacion(mias.find((s) => s.vacanteId === id) || null))
      .catch(() => setMiPostulacion(null));
  }, [id, token]);

  if (error) {
    return (
      <>
        <DocHeader title="Error" />
        <main className="page"><div className="card"><div className="notice notice--danger">{error}</div></div></main>
      </>
    );
  }

  if (vacante === undefined) return null;

  if (!vacante) {
    return (
      <>
        <DocHeader title="Vacante no encontrada" />
        <main className="page">
          <div className="card">
            <div className="empty-state">No encontramos esta vacante. Puede que ya no esté disponible.</div>
          </div>
        </main>
      </>
    );
  }

  const c = vacante.criterios || {};

  return (
    <>
      <DocHeader title={vacante.cargo} />
      <main className="page">
        <div className="card mt-24">
          <div className="vac-card__proceso">Proceso de Selección No. {vacante.procesoNo}</div>
          <h2 className="section-title" style={{ marginTop: 4 }}>{vacante.cargo}</h2>
          {vacante.descripcion && <p style={{ fontSize: 14, color: "var(--color-text)", margin: "4px 0 16px" }}>{vacante.descripcion}</p>}

          <div className="field-grid" style={{ margin: "16px 0" }}>
            <div className="info-box"><label>Proceso / Área</label><div className="value">{vacante.area || "—"}</div></div>
            <div className="info-box"><label>Salario básico</label><div className="value">{vacante.salario || "—"}</div></div>
            <div className="info-box"><label>Tipo de vinculación</label><div className="value">{vacante.tipoVinculacion || "—"}</div></div>
            <div className="info-box"><label>N° de plazas</label><div className="value">{vacante.plazas || "—"}</div></div>
            <div className="info-box"><label>Público objetivo</label><div className="value">{vacante.publicoObjetivo || "—"}</div></div>
            <div className="info-box"><label>Fecha y hora de cierre</label><div className="value">{vacante.fechaCierre || "—"} / {vacante.horaCierre || ""}</div></div>
          </div>

          {vacante.requisitosObligatorios && (
            <>
              <h3 className="section-title" style={{ fontSize: 15 }}>Requisitos obligatorios</h3>
              <p className="text-muted">{vacante.requisitosObligatorios}</p>
            </>
          )}

          <h3 className="section-title" style={{ fontSize: 15 }}>Requisitos evaluados en la inscripción</h3>
          <ul style={{ margin: "4px 0 14px 18px", padding: 0, fontSize: 13.5 }}>
            {c.nivelEducativoMin && <li>Nivel educativo mínimo: {c.nivelEducativoMin}{c.graduadoRequerido ? " (graduado)" : ""}</li>}
            {c.profesionKeyword && <li>Profesión / título relacionado con: "{c.profesionKeyword}"</li>}
            {c.experienciaMinAnios && <li>Experiencia mínima: {c.experienciaMinAnios} años</li>}
            {c.idiomaRequerido && <li>Idioma: {c.idiomaRequerido} — nivel mínimo {c.idiomaNivelMin} ({c.idiomaHabilidad})</li>}
            {(c.certificacionesKeywords || []).map((cert, i) => (
              <li key={i}>Certificación relacionada con: "{cert}"</li>
            ))}
            {!c.nivelEducativoMin && !c.profesionKeyword && !c.experienciaMinAnios && !c.idiomaRequerido && (c.certificacionesKeywords || []).length === 0 && (
              <li className="text-muted">Esta vacante no tiene requisitos específicos configurados.</li>
            )}
          </ul>

          {vacante.conocimientosComplementarios && (
            <>
              <h3 className="section-title" style={{ fontSize: 15 }}>Conocimientos complementarios</h3>
              <p className="text-muted">{vacante.conocimientosComplementarios}</p>
            </>
          )}

          {vacante.tieneDocumentoPdf && (
            <div className="field mt-24">
              <a href={vacantesApi.urlDocumentoPdf(vacante.id)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                📄 Ver formato oficial de la convocatoria (PDF)
              </a>
            </div>
          )}

          <div className="wizard-actions" style={{ justifyContent: "flex-end" }}>
            {miPostulacion ? (
              <div className="notice notice--info" style={{ margin: 0 }}>
                Ya te inscribiste a esta vacante (radicado <strong>{miPostulacion.radicado}</strong>).{" "}
                <Link to="/mis-postulaciones">Ver mis postulaciones →</Link>
              </div>
            ) : vacante.estaCerrada ? (
              <div className="notice notice--danger" style={{ margin: 0 }}>
                Esta convocatoria cerró el {vacante.fechaCierre} a las {vacante.horaCierre}. Ya no se reciben inscripciones.
              </div>
            ) : usuario?.rol === "gestor_humano" || usuario?.rol === "admin" ? (
              <div className="notice notice--info" style={{ margin: 0 }}>
                Tu cuenta tiene rol de {usuario.rol === "admin" ? "Administrador" : "Gestión Humana"}, no puedes postularte a vacantes.
                Administra esta convocatoria desde el panel de Gestión Humana.
              </div>
            ) : (
              <Link to={`/postularme/${vacante.id}`} className="btn btn-primary">Iniciar solicitud de inscripción</Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
