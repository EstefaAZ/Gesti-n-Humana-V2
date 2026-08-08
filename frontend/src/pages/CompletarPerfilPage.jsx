import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import FolioNav from "../components/FolioNav";
import HojaI from "../components/steps/HojaI";
import HojaII from "../components/steps/HojaII";
import HojaVI from "../components/steps/HojaVI";
import HojaVII from "../components/steps/HojaVII";
import HojaVIII from "../components/steps/HojaVIII";
import HojaDocumentos from "../components/steps/HojaDocumentos";
import {
  STEPS, initialSolicitudState, nuevoRegistroII, nuevaExperiencia, nuevoFamiliar,
} from "../lib/formState";
import { useAuth } from "../context/AuthContext";
import * as perfilesApi from "../lib/api/perfilesApi";
import { ApiError } from "../lib/api/httpClient";

function _perfilAEstadoWizard(perfil) {
  return {
    stepIndex: 0,
    urlLocked: false,
    datosPersonales: { proceso: "", fechaEntrega: "", ...perfil.datosPersonales },
    registrosII: perfil.registrosII || [],
    experiencias: perfil.experiencia || [],
    conflicto: perfil.conflicto?.tieneVinculo
      ? perfil.conflicto
      : { tieneVinculo: "no", familiares: [], tieneOtraInhabilidad: "no", descripcionInhabilidad: "", ...perfil.conflicto },
    autorizacion: { acepta: perfil.autorizacion?.acepta ?? false, nombreCompleto: perfil.autorizacion?.nombreCompleto || "" },
    documentos: {
      cedula: perfil.documentosAdjuntos?.cedula || [],
      certificadosLaborales: perfil.documentosAdjuntos?.certificadosLaborales || [],
      certificadosEstudio: perfil.documentosAdjuntos?.certificadosEstudio || [],
      tarjetaProfesional: perfil.documentosAdjuntos?.tarjetaProfesional || [],
    },
    errors: {},
  };
}

export default function CompletarPerfilPage() {
  const { token, refrescarEstadoPerfil } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    perfilesApi
      .obtenerMiPerfil(token)
      .then((perfil) => setState(_perfilAEstadoWizard(perfil)))
      .catch(() => setState(initialSolicitudState()))
      .finally(() => setCargando(false));
  }, [token]);

  const activeStep = STEPS[stepIndex];
  const doneSteps = useMemo(() => STEPS.slice(0, stepIndex), [stepIndex]);

  if (cargando || !state) return null;

  // ---- Helpers de actualización de estado (idénticos a SolicitudPage) ----
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

  // ---- Validación (igual que SolicitudPage) ----
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

    if (step === "VIII") {
      if (!state.autorizacion.acepta) {
        nuevosErrores.aceptaClausulas = "Debe aceptar las cláusulas.";
      } else if (!state.autorizacion.nombreCompleto.trim()) {
        nuevosErrores.nombreAutorizacion = "Este campo es obligatorio.";
      }
    }

    setErrors(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function onSiguiente() {
    if (!validarPasoActual()) return;
    if (STEPS[stepIndex] === "VIII") {
      finalizarPerfil();
      return;
    }
    setStepIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onAtras() {
    setStepIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finalizarPerfil() {
    setErrorEnvio("");
    setEnviando(true);
    try {
      await perfilesApi.guardarPerfil(
        {
          datosPersonales: state.datosPersonales,
          registrosII: state.registrosII,
          experiencia: state.experiencias,
          conflicto: state.conflicto,
          autorizacion: state.autorizacion,
          documentosAdjuntos: state.documentos,
        },
        token
      );
      await refrescarEstadoPerfil();
      navigate("/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && typeof e.detail === "string" && e.detail.includes("Autorización")) {
        setErrorEnvio(e.detail);
        setStepIndex(STEPS.indexOf("VIII"));
      } else {
        setErrorEnvio("No se pudo guardar tu perfil. Intenta de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <DocHeader title="Completa tu perfil" showCode={false} />
      <main className="page">
        <div className="card">
          <div className="notice notice--info">
            Este formulario se llena <strong>una sola vez</strong>. Cuando termines, podrás inscribirte a cualquier
            vacante con un solo clic — sin volver a llenarlo, solo adjuntando certificaciones extra si una vacante
            en particular las requiere.
          </div>
          {errorEnvio && <div className="notice notice--danger">{errorEnvio}</div>}

          <FolioNav steps={STEPS} activeStep={activeStep} doneSteps={doneSteps} />

          {activeStep === "I" && <HojaI datos={state.datosPersonales} setDatos={setDatos} errors={errors} ocultarProceso />}
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
          {activeStep === "DOCS" && (
            <HojaDocumentos documentos={state.documentos} setDocumentos={setDocumentos} errors={errors} />
          )}
          {activeStep === "VIII" && (
            <HojaVIII autorizacion={state.autorizacion} setAutorizacion={setAutorizacion} errors={errors} />
          )}

          <div className="wizard-actions">
            <button type="button" className="btn btn-secondary" onClick={onAtras} style={{ visibility: stepIndex === 0 ? "hidden" : "visible" }}>
              Atrás
            </button>
            <button type="button" className="btn btn-primary" onClick={onSiguiente} disabled={enviando}>
              {enviando ? "Guardando…" : STEPS[stepIndex] === "VIII" ? "Guardar perfil" : "Siguiente"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
