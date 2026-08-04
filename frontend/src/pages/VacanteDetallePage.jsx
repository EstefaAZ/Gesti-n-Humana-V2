import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import * as vacantesApi from "../lib/api/vacantesApi";

export default function VacanteDetallePage() {
  const { id } = useParams();
  const [vacante, setVacante] = useState(undefined); // undefined = cargando, null = no encontrada
  const [error, setError] = useState("");

  useEffect(() => {
    vacantesApi
      .obtenerPublica(id)
      .then(setVacante)
      .catch((e) => (e.status === 404 ? setVacante(null) : setError("No se pudo cargar la vacante.")));
  }, [id]);

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
            <p className="text-center mt-24"><Link to="/" className="text-muted">← Ver todas las vacantes</Link></p>
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
        <Link to="/" className="text-muted">← Ver todas las vacantes</Link>
        <div className="card mt-24">
          <div className="vac-card__proceso">Proceso de Selección No. {vacante.procesoNo}</div>
          <h2 className="section-title" style={{ marginTop: 4 }}>{vacante.cargo}</h2>

          <div className="field-grid" style={{ margin: "16px 0" }}>
            <div className="info-box"><label>Proceso / Área</label><div className="value">{vacante.area || "—"}</div></div>
            <div className="info-box"><label>Salario básico</label><div className="value">{vacante.salario || "—"}</div></div>
            <div className="info-box"><label>Tipo de vinculación</label><div className="value">{vacante.tipoVinculacion || "—"}</div></div>
            <div className="info-box"><label>Sede</label><div className="value">{vacante.sede || "—"}</div></div>
            <div className="info-box"><label>N° de plazas</label><div className="value">{vacante.plazas || "—"}</div></div>
            <div className="info-box"><label>Público objetivo</label><div className="value">{vacante.publicoObjetivo || "—"}</div></div>
            <div className="info-box"><label>Fecha de cierre</label><div className="value">{vacante.fechaCierre || "—"} {vacante.horaCierre || ""}</div></div>
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
            {c.certificacionKeyword && <li>Certificación relacionada con: "{c.certificacionKeyword}"</li>}
            {c.ciudadRequerida && <li>Ciudad de residencia: {c.ciudadRequerida}</li>}
            {!c.nivelEducativoMin && !c.profesionKeyword && !c.experienciaMinAnios && !c.idiomaRequerido && !c.certificacionKeyword && !c.ciudadRequerida && (
              <li className="text-muted">Esta vacante no tiene requisitos específicos configurados.</li>
            )}
          </ul>

          {vacante.conocimientosComplementarios && (
            <>
              <h3 className="section-title" style={{ fontSize: 15 }}>Conocimientos complementarios</h3>
              <p className="text-muted">{vacante.conocimientosComplementarios}</p>
            </>
          )}

          <div className="wizard-actions" style={{ justifyContent: "flex-end" }}>
            {vacante.estaCerrada ? (
              <div className="notice notice--danger" style={{ margin: 0 }}>
                Esta convocatoria cerró el {vacante.fechaCierre} a las {vacante.horaCierre}. Ya no se reciben inscripciones.
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
