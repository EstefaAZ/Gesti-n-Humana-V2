import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import FolioNav from "../components/FolioNav";
import HojaI from "../components/steps/HojaI";
import HojaII from "../components/steps/HojaII";
import HojaVI from "../components/steps/HojaVI";
import HojaVII from "../components/steps/HojaVII";
import HojaVIII from "../components/steps/HojaVIII";
import HojaDocumentos from "../components/steps/HojaDocumentos";
import Confirmacion from "../components/steps/Confirmacion";
import {
  STEPS, initialSolicitudState, nuevoRegistroII, nuevaExperiencia, nuevoFamiliar,
} from "../lib/formState";
import { useAuth } from "../context/AuthContext";
import * as vacantesApi from "../lib/api/vacantesApi";
import * as solicitudesApi from "../lib/api/solicitudesApi";
import { ApiError } from "../lib/api/httpClient";

export default function SolicitudPage() {
  const { id: vacanteId } = useParams();
  const { token } = useAuth();
  const [vacante, setVacante] = useState(undefined); // undefined = cargando, null = no encontrada
  const [errorCarga, setErrorCarga] = useState("");

  useEffect(() => {
    vacantesApi
      .obtenerPublica(vacanteId)
      .then(setVacante)
      .catch((e) => (e.status === 404 ? setVacante(null) : setErrorCarga("No se pudo cargar la vacante.")));
  }, [vacanteId]);

  const [state, setState] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [radicado, setRadicado] = useState(null);

  useEffect(() => {
    if (vacante) {
      setState(
        initialSolicitudState({ proceso: vacante.procesoNo, fechaEntrega: vacante.fechaCierre, locked: true })
      );
    }
  }, [vacante]);

  const activeStep = enviado ? "confirmacion" : STEPS[stepIndex];
  const doneSteps = useMemo(() => STEPS.slice(0, stepIndex), [stepIndex]);

  if (errorCarga) {
    return (
      <>
        <DocHeader title="Error" />
        <main className="page"><div className="card"><div className="notice notice--danger">{errorCarga}</div></div></main>
      </>
    );
  }

  if (vacante === undefined || (vacante && !state)) return null;

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

  if (vacante.estaCerrada && !enviado) {
    return (
      <>
        <DocHeader title={vacante.cargo} />
        <main className="page">
          <div className="card">
            <div className="notice notice--danger">
              Esta convocatoria cerró el {vacante.fechaCierre} a las {vacante.horaCierre}. Ya no se reciben inscripciones para este proceso.
            </div>
            <p className="text-center"><Link to="/" className="text-muted">← Ver todas las vacantes</Link></p>
          </div>
        </main>
      </>
    );
  }

  // ---- Helpers de actualización de estado ----
  const setDatos = (patch) => setState((s) => ({ ...s, datosPersonales: { ...s.datosPersonales, ...patch } }));
  const setConflicto = (patch) => setState((s) => ({ ...s, conflicto: { ...s.conflicto, ...patch } }));
  const setAutorizacion = (patch) => setState((s) => ({ ...s, autorizacion: { ...s.autorizacion, ...patch } }));
  const setDocumentos = (updater) =>
    setState((s) => ({ ...s, documentos: typeof updater === "function" ? updater(s.documentos) : { ...s.documentos, ...updater } }));

  const addRegistro = () =>
    setState((s) => (s.registrosII.length >= 15 ? s : { ...s, registrosII: [...s.registrosII, nuevoRegistroII()] }));
  const removeRegistro = (id) =>
    setState((s) => ({ ...s, registrosII: s.registrosII.filter((r) => r.id !== id) }));
  const changeRegistro = (id, patch) =>
    setState((s) => ({ ...s, registrosII: s.registrosII.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const addExperiencia = () =>
    setState((s) => (s.experiencias.length >= 10 ? s : { ...s, experiencias: [...s.experiencias, nuevaExperiencia()] }));
  const removeExperiencia = (id) =>
    setState((s) => ({ ...s, experiencias: s.experiencias.filter((e) => e.id !== id) }));
  const changeExperiencia = (id, patch) =>
    setState((s) => ({ ...s, experiencias: s.experiencias.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  const addFamiliar = () =>
    setState((s) =>
      s.conflicto.familiares.length >= 5
        ? s
        : { ...s, conflicto: { ...s.conflicto, familiares: [...s.conflicto.familiares, nuevoFamiliar()] } }
    );
  const removeFamiliar = (id) =>
    setState((s) => ({ ...s, conflicto: { ...s.conflicto, familiares: s.conflicto.familiares.filter((f) => f.id !== id) } }));
  const changeFamiliar = (id, patch) =>
    setState((s) => ({
      ...s,
      conflicto: { ...s.conflicto, familiares: s.conflicto.familiares.map((f) => (f.id === id ? { ...f, ...patch } : f)) },
    }));

  // ---- Validación ----
  function validarPasoActual() {
    const step = STEPS[stepIndex];
    const nuevosErrores = {};

    if (step === "I") {
      const requeridos = [
        "nombreCompleto", "cedula", "cedulaDe", "ciudadNacimiento", "deptoNacimiento",
        "paisNacimiento", "fechaNacimiento", "correo", "direccion", "municipio",
        "deptoResidencia", "celular", "estadoCivil", "numHijos",
      ];
      requeridos.forEach((campo) => {
        if (!String(state.datosPersonales[campo] || "").trim()) {
          nuevosErrores[campo] = "Este campo es obligatorio.";
        }
      });
    }

    if (step === "VII") {
      if (state.conflicto.tieneVinculo === "si" && state.conflicto.familiares.length === 0) {
        nuevosErrores.familiares = "Agregue al menos un familiar o cambie la respuesta a \"No\".";
      }
      if (state.conflicto.tieneOtraInhabilidad === "si" && !state.conflicto.descripcionInhabilidad.trim()) {
        nuevosErrores.descripcionInhabilidad = "Debe describir la situación.";
      }
    }

    if (step === "VIII") {
      if (!state.autorizacion.acepta) {
        nuevosErrores.aceptaClausulas = "Debe aceptar las cláusulas.";
      } else if (!state.autorizacion.nombreCompleto.trim()) {
        nuevosErrores.nombreAutorizacion = "Este campo es obligatorio.";
      }
    }

    if (step === "DOCS") {
      const requeridos = {
        cedula: "Debes adjuntar tu cédula de ciudadanía.",
        certificadosLaborales: "Debes adjuntar al menos un certificado laboral con funciones.",
        certificadosEstudio: "Debes adjuntar al menos un certificado de estudio y/o curso.",
        tarjetaProfesional: "Debes adjuntar tu tarjeta profesional.",
      };
      Object.entries(requeridos).forEach(([clave, mensaje]) => {
        if ((state.documentos[clave] || []).length === 0) {
          nuevosErrores[clave] = mensaje;
        }
      });
      if (Object.keys(nuevosErrores).length > 0) {
        alert("Te falta adjuntar: " + Object.values(nuevosErrores).join(" "));
      }
    }

    setErrors(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function onSiguiente() {
    if (!validarPasoActual()) return;
    if (STEPS[stepIndex] === "DOCS") {
      finalizarSolicitud();
      return;
    }
    setStepIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onAtras() {
    setStepIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finalizarSolicitud() {
    setErrorEnvio("");
    setEnviando(true);
    try {
      const solicitud = await solicitudesApi.crear(
        {
          vacanteId: vacante.id,
          datosPersonales: state.datosPersonales,
          registrosII: state.registrosII,
          experiencia: state.experiencias,
          conflicto: state.conflicto,
          autorizacion: state.autorizacion,
          documentosAdjuntos: state.documentos,
        },
        token
      );
      setRadicado(solicitud.radicado);
      setEnviado(true);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 503)) {
        setErrorEnvio(e.detail || "Ya existe una solicitud tuya para esta vacante, o la convocatoria ya cerró.");
      } else {
        setErrorEnvio("No se pudo enviar la solicitud. Intenta de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <DocHeader title={`Solicitud de Inscripción — ${vacante.cargo}`} />
      <main className="page">
        <div className="card">
          {!enviado && (
            <div className="notice notice--info">
              Proceso {vacante.procesoNo} — {vacante.cargo}. El proceso y la fecha de cierre quedan tomados de esta
              convocatoria y no se pueden editar.
            </div>
          )}
          {errorEnvio && <div className="notice notice--danger">{errorEnvio}</div>}

          {!enviado && <FolioNav steps={STEPS} activeStep={activeStep} doneSteps={doneSteps} />}

          {activeStep === "I" && <HojaI datos={{ ...state.datosPersonales, urlLocked: true }} setDatos={setDatos} errors={errors} />}
          {activeStep === "II" && (
            <HojaII registros={state.registrosII} onAdd={addRegistro} onRemove={removeRegistro} onChange={changeRegistro} />
          )}
          {activeStep === "VI" && (
            <HojaVI experiencias={state.experiencias} onAdd={addExperiencia} onRemove={removeExperiencia} onChange={changeExperiencia} />
          )}
          {activeStep === "VII" && (
            <HojaVII
              conflicto={state.conflicto}
              setConflicto={setConflicto}
              onAddFamiliar={addFamiliar}
              onRemoveFamiliar={removeFamiliar}
              onChangeFamiliar={changeFamiliar}
              errors={errors}
            />
          )}
          {activeStep === "VIII" && (
            <HojaVIII autorizacion={state.autorizacion} setAutorizacion={setAutorizacion} errors={errors} />
          )}
          {activeStep === "DOCS" && (
            <HojaDocumentos documentos={state.documentos} setDocumentos={setDocumentos} errors={errors} />
          )}
          {activeStep === "confirmacion" && (
            <Confirmacion radicado={radicado} onDescargarPdf={() => solicitudesApi.descargarPdf(radicado, token)} />
          )}

          {!enviado && (
            <div className="wizard-actions">
              <button type="button" className="btn btn-secondary" onClick={onAtras} style={{ visibility: stepIndex === 0 ? "hidden" : "visible" }}>
                Atrás
              </button>
              <button type="button" className="btn btn-primary" onClick={onSiguiente} disabled={enviando}>
                {enviando ? "Enviando…" : STEPS[stepIndex] === "DOCS" ? "Enviar solicitud" : "Siguiente"}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
