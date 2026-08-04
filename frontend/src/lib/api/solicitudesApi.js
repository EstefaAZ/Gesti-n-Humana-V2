import { apiFetch } from "./httpClient";
import { API_URLS } from "./config";
import { deepToCamel } from "./caseConverter";

const BASE = `${API_URLS.candidatos}/api/v1/solicitudes`;

function _documentosACamel(d) {
  if (!d) return { cedula: [], certificadosLaborales: [], certificadosEstudio: [], tarjetaProfesional: [] };
  return {
    cedula: d.cedula || [],
    certificadosLaborales: d.certificados_laborales || [],
    certificadosEstudio: d.certificados_estudio || [],
    tarjetaProfesional: d.tarjeta_profesional || [],
  };
}

// Solo se normalizan las llaves de PRIMER NIVEL. El contenido de
// datosPersonales/registrosII/experiencia/conflicto/autorizacion se envía y
// recibe tal cual, en camelCase, porque la evaluación automática del backend
// ya espera esas llaves exactas (nivelEducativo, fechaInicio, graduado, etc.).
function _solicitudACamel(s) {
  if (!s) return s;
  return {
    radicado: s.radicado,
    vacanteId: s.vacante_id,
    usuarioId: s.usuario_id,
    datosPersonales: s.datos_personales,
    registrosII: s.registros_ii,
    experiencia: s.experiencia,
    conflicto: s.conflicto,
    autorizacion: s.autorizacion,
    documentosAdjuntos: _documentosACamel(s.documentos_adjuntos),
    evaluacion: s.evaluacion,
    estado: s.estado,
    historialEstados: s.historial_estados,
    fechaSolicitud: s.fecha_solicitud,
  };
}

// Los 4 tipos de documento con sus límites reales y la llave que usa la API
// (snake_case) — deben coincidir con el backend.
export const CATEGORIAS_DOCUMENTOS = [
  { clave: "cedula", claveApi: "cedula", etiqueta: "Cédula de ciudadanía", max: 1 },
  { clave: "certificadosLaborales", claveApi: "certificados_laborales", etiqueta: "Certificados laborales con funciones", max: 10 },
  { clave: "certificadosEstudio", claveApi: "certificados_estudio", etiqueta: "Certificados de estudio y/o cursos", max: 10 },
  { clave: "tarjetaProfesional", claveApi: "tarjeta_profesional", etiqueta: "Tarjeta profesional", max: 3 },
];

function _documentosASnake(lista) {
  return (lista || []).map((d) => ({ nombre: d.nombre, contenido_base64: d.contenidoBase64 }));
}

export async function crear(solicitudCamel, token) {
  const body = {
    vacante_id: solicitudCamel.vacanteId,
    datos_personales: solicitudCamel.datosPersonales,
    registros_ii: solicitudCamel.registrosII,
    experiencia: solicitudCamel.experiencia,
    conflicto: solicitudCamel.conflicto,
    autorizacion: solicitudCamel.autorizacion,
    documentos_adjuntos: {
      cedula: _documentosASnake(solicitudCamel.documentosAdjuntos?.cedula),
      certificados_laborales: _documentosASnake(solicitudCamel.documentosAdjuntos?.certificadosLaborales),
      certificados_estudio: _documentosASnake(solicitudCamel.documentosAdjuntos?.certificadosEstudio),
      tarjeta_profesional: _documentosASnake(solicitudCamel.documentosAdjuntos?.tarjetaProfesional),
    },
  };
  const data = await apiFetch(BASE, { method: "POST", token, body });
  return _solicitudACamel(data);
}

export async function misSolicitudes(token) {
  const data = await apiFetch(`${BASE}/mias`, { token });
  return data.map(_solicitudACamel);
}

export async function obtener(radicado, token) {
  const data = await apiFetch(`${BASE}/${radicado}`, { token });
  return _solicitudACamel(data);
}

export async function listarPorVacante(vacanteId, token) {
  const data = await apiFetch(`${BASE}/vacante/${vacanteId}`, { token });
  return data.map(_solicitudACamel);
}

export async function cambiarEstado(radicado, estado, token) {
  const data = await apiFetch(`${BASE}/${radicado}/estado`, { method: "PATCH", token, body: { estado } });
  return _solicitudACamel(data);
}

export async function eliminar(radicado, token) {
  await apiFetch(`${BASE}/${radicado}`, { method: "DELETE", token });
}

export async function descargarPdf(radicado, token) {
  const res = await apiFetch(`${BASE}/${radicado}/pdf`, { token, raw: true });
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${radicado}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function obtenerEstadisticas(token) {
  // A diferencia de crear()/obtener(), este endpoint es 100% campos propios
  // (no contenido libre del candidato), así que sí es seguro convertir todo.
  const data = await apiFetch(`${BASE}/admin/estadisticas`, { token });
  return deepToCamel(data);
}

export async function obtenerAuditoria(token, limite = 100) {
  const data = await apiFetch(`${BASE}/admin/auditoria/eventos?limite=${limite}`, { token });
  return deepToCamel(data);
}

export async function descargarDocumentoAdjunto(radicado, categoriaApi, indice, nombreArchivo, token) {
  const res = await apiFetch(`${BASE}/${radicado}/documentos/${categoriaApi}/${indice}`, { token, raw: true });
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo || "documento";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
