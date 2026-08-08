import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import * as vacantesApi from "../lib/api/vacantesApi";
import * as solicitudesApi from "../lib/api/solicitudesApi";
import * as perfilesApi from "../lib/api/perfilesApi";
import { archivoABase64 } from "../lib/formState";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api/httpClient";

const CATEGORIAS_EXTRA = [
  { clave: "certificadosLaborales", etiqueta: "Certificados laborales adicionales" },
  { clave: "certificadosEstudio", etiqueta: "Certificados de estudio y/o cursos adicionales" },
  { clave: "tarjetaProfesional", etiqueta: "Tarjeta profesional (si no la subiste en tu perfil)" },
];

export default function VacanteDetallePage() {
  const { id } = useParams();
  const { token, usuario } = useAuth();
  const [vacante, setVacante] = useState(undefined); // undefined = cargando, null = no encontrada
  const [error, setError] = useState("");
  const [miPostulacion, setMiPostulacion] = useState(undefined); // undefined = cargando, null = no se ha postulado

  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [perfil, setPerfil] = useState(null);
  const [documentosExtra, setDocumentosExtra] = useState({ cedula: [], certificadosLaborales: [], certificadosEstudio: [], tarjetaProfesional: [] });
  const [inscribiendo, setInscribiendo] = useState(false);
  const [errorInscripcion, setErrorInscripcion] = useState("");

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

  function abrirConfirmacion() {
    setMostrarConfirmacion(true);
    if (!perfil) {
      perfilesApi.obtenerMiPerfil(token).then(setPerfil).catch(() => {});
    }
  }

  async function agregarArchivoExtra(clave, file) {
    if (!file) return;
    const contenidoBase64 = await archivoABase64(file);
    setDocumentosExtra((prev) => ({ ...prev, [clave]: [...prev[clave], { nombre: file.name, contenidoBase64 }] }));
  }

  function quitarArchivoExtra(clave, indice) {
    setDocumentosExtra((prev) => ({ ...prev, [clave]: prev[clave].filter((_, i) => i !== indice) }));
  }

  async function confirmarInscripcion() {
    setErrorInscripcion("");
    setInscribiendo(true);
    try {
      const solicitud = await solicitudesApi.inscribirme(vacante.id, documentosExtra, token);
      setMiPostulacion(solicitud);
      setMostrarConfirmacion(false);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorInscripcion(e.detail || "No se pudo completar la inscripción.");
      } else {
        setErrorInscripcion("No se pudo completar la inscripción. Intenta de nuevo.");
      }
    } finally {
      setInscribiendo(false);
    }
  }

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

          {errorInscripcion && <div className="notice notice--danger">{errorInscripcion}</div>}

          {mostrarConfirmacion && !miPostulacion && (
            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 20, marginTop: 20 }}>
              <h3 className="section-title" style={{ fontSize: 15 }}>Confirmar inscripción</h3>
              {!perfil ? (
                <p className="text-muted">Cargando tu perfil…</p>
              ) : (
                <>
                  <p style={{ fontSize: 13.5 }}>
                    Vas a inscribirte con los datos de tu perfil: <strong>{perfil.datosPersonales?.nombreCompleto}</strong>,{" "}
                    {perfil.registrosII?.length || 0} registro(s) de estudio y {perfil.experiencia?.length || 0} experiencia(s) laboral(es).{" "}
                    <Link to="/completar-perfil">¿Necesitas actualizar tu perfil?</Link>
                  </p>

                  <p className="text-muted" style={{ fontSize: 12.5, marginTop: 16 }}>
                    Si esta vacante requiere alguna certificación adicional que no subiste en tu perfil, puedes adjuntarla aquí (opcional):
                  </p>
                  {CATEGORIAS_EXTRA.map((cat) => (
                    <div key={cat.clave} className="field" style={{ marginBottom: 14 }}>
                      <label>{cat.etiqueta}</label>
                      {documentosExtra[cat.clave].length > 0 && (
                        <ul style={{ listStyle: "none", margin: "0 0 6px", padding: 0 }}>
                          {documentosExtra[cat.clave].map((doc, i) => (
                            <li key={i} style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
                              📄 {doc.nombre}
                              <button type="button" className="hr-link-btn hr-link-btn--danger" onClick={() => quitarArchivoExtra(cat.clave, i)}>Quitar</button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => {
                          agregarArchivoExtra(cat.clave, e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  ))}

                  <div className="wizard-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setMostrarConfirmacion(false)} disabled={inscribiendo}>
                      Cancelar
                    </button>
                    <button type="button" className="btn btn-primary" onClick={confirmarInscripcion} disabled={inscribiendo}>
                      {inscribiendo ? "Enviando…" : "Confirmar inscripción"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="wizard-actions" style={{ justifyContent: "flex-end" }}>
            {miPostulacion ? (
              <div className="notice notice--info" style={{ margin: 0 }}>
                Ya te inscribiste a esta vacante (tú radicado es: <strong>{miPostulacion.radicado}</strong>).{" "}
              </div>
            ) : vacante.estaCerrada ? (
              <div className="notice notice--danger" style={{ margin: 0 }}>
                Esta convocatoria cerró el {vacante.fechaCierre} a las {vacante.horaCierre}. Ya no se reciben inscripciones.
              </div>
            ) : usuario?.rol === "gestor_humano" || usuario?.rol === "admin" ? (
              <div className="notice notice--info" style={{ margin: 0 }}>
                Tu cuenta tiene rol de {usuario.rol === "admin" ? "Administrador" : "Gestión Humana"} — no puedes postularte a vacantes.
                Administra esta convocatoria desde el panel de Gestión Humana.
              </div>
            ) : !mostrarConfirmacion ? (
              <button type="button" className="btn btn-primary" onClick={abrirConfirmacion}>Inscribirme</button>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}
