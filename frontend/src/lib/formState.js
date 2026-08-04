import { TIPO_REGISTRO_LABELS } from "../data/catalogos";

export const STEPS = ["I", "II", "VI", "VII", "VIII", "DOCS"];

let seq = 0;
export function nextId(prefix) {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function initialSolicitudState({ proceso = "", fechaEntrega = "", locked = false } = {}) {
  return {
    stepIndex: 0,
    urlLocked: locked,
    datosPersonales: {
      proceso, fechaEntrega,
      nombreCompleto: "", cedula: "", cedulaDe: "",
      ciudadNacimiento: "", deptoNacimiento: "", paisNacimiento: "Colombia", fechaNacimiento: "",
      licencia: "no", licenciaClase: "",
      correo: "", direccion: "", municipio: "", deptoResidencia: "",
      telResidencia: "", celular: "",
      estadoCivil: "", numHijos: "", tieneVehiculo: "no",
      tarjetaProfesional: "", profesion: "", fechaTarjeta: "",
    },
    registrosII: [],
    experiencias: [],
    conflicto: {
      tieneVinculo: "no",
      familiares: [],
      tieneOtraInhabilidad: "no",
      descripcionInhabilidad: "",
    },
    autorizacion: { acepta: false, nombreCompleto: "" },
    documentos: {
      cedula: [],
      certificadosLaborales: [],
      certificadosEstudio: [],
      tarjetaProfesional: [],
    },
    errors: {},
  };
}

export function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result viene como "data:<mime>;base64,AAAA..." — solo nos interesa la parte de base64.
      const base64 = String(reader.result).split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function calcularTiempoLaborado(inicio, fin) {
  if (!inicio) return "—";
  const d1 = new Date(inicio);
  const d2 = fin ? new Date(fin) : new Date();
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()) || d2 < d1) return "—";
  let años = d2.getFullYear() - d1.getFullYear();
  let meses = d2.getMonth() - d1.getMonth();
  let dias = d2.getDate() - d1.getDate();
  if (dias < 0) {
    meses -= 1;
    dias += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
  }
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }
  return `${años} año(s), ${meses} mes(es), ${dias} día(s)`;
}

export function nuevoRegistroII() {
  return { id: nextId("reg"), tipo: "estudio", tipoLabel: TIPO_REGISTRO_LABELS.estudio };
}

export function nuevaExperiencia() {
  return { id: nextId("exp"), actual: false, tiempoLaborado: "—" };
}

export function nuevoFamiliar() {
  return { id: nextId("fam"), parentesco: "", nombreEmpleado: "", cargo: "" };
}
