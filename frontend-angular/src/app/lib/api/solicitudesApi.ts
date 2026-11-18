import { apiFetch } from "./httpClient";
import { API_URLS } from "./config";
import { deepToCamel } from "./caseConverter";

const BASE = `${API_URLS.candidatos}/api/v1/solicitudes`;

// Solo se normalizan las llaves de PRIMER NIVEL. El contenido de
// datosPersonales/registrosII/experiencia/conflicto/autorizacion se envía y
// recibe tal cual, en camelCase, porque la evaluación automática del backend
// ya espera esas llaves exactas (nivelEducativo, fechaInicio, graduado, etc.).
function _documentosACamel(d) {
  if (!d) return { cedula: [], certificadosLaborales: [], certificadosEstudio: [], tarjetaProfesional: [] };
  return {
    cedula: d.cedula || [],
    certificadosLaborales: d.certificados_laborales || [],
    certificadosEstudio: d.certificados_estudio || [],
    tarjetaProfesional: d.tarjeta_profesional || [],
  };
}

function _solicitudACamel(s) {
  if (!s) return s;
  return {
    radicado: s.radicado,
    vacanteId: s.vacante_id,
    vacanteCargo: s.vacante_cargo,
    vacanteProcesoNo: s.vacante_proceso_no,
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
    // Solo en "Mis postulaciones": estado actual de la convocatoria (null si no se pudo consultar).
    convocatoria: s.convocatoria
      ? {
          estado: s.convocatoria.estado,
          estaCerrada: !!s.convocatoria.esta_cerrada,
          fechaCierre: s.convocatoria.fecha_cierre,
          horaCierre: s.convocatoria.hora_cierre,
          eliminada: !!s.convocatoria.eliminada,
        }
      : null,
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

export async function inscribirme(vacanteId, documentosExtraCamel, token) {
  const body: any = { vacante_id: vacanteId };
  const tieneExtras = documentosExtraCamel && Object.values(documentosExtraCamel).some((lista: any) => lista?.length > 0);
  if (tieneExtras) {
    body.documentos_extra = {
      cedula: _documentosASnake(documentosExtraCamel.cedula),
      certificados_laborales: _documentosASnake(documentosExtraCamel.certificadosLaborales),
      certificados_estudio: _documentosASnake(documentosExtraCamel.certificadosEstudio),
      tarjeta_profesional: _documentosASnake(documentosExtraCamel.tarjetaProfesional),
    };
  }
  const data = await apiFetch(`${BASE}/inscribirme`, { method: "POST", token, body });
  return _solicitudACamel(data);
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

export async function retirar(radicado, token) {
  const data = await apiFetch(`${BASE}/${radicado}/retirar`, { method: "PATCH", token });
  return _solicitudACamel(data);
}

/**
 * Nombre del archivo que manda el servidor en Content-Disposition (filename*
 * con tildes, si viene; si no, filename). null si no viene ninguno.
 */
function nombreDesdeCabecera(res: Response): string | null {
  const cabecera = res.headers.get("Content-Disposition") || "";
  const conTildes = /filename\*=UTF-8''([^;]+)/i.exec(cabecera);
  if (conTildes) {
    try {
      return decodeURIComponent(conTildes[1].trim());
    } catch {
      // si viene mal codificado, se usa el nombre simple
    }
  }
  const simple = /filename="?([^";]+)"?/i.exec(cabecera);
  return simple ? simple[1].trim() : null;
}

/** PDF de la solicitud, con el nombre "ID del proceso - Nombre candidato.pdf" que arma el servidor. */
export async function descargarPdf(radicado, token) {
  const res = await apiFetch(`${BASE}/${radicado}/pdf`, { token, raw: true });
  const nombre = nombreDesdeCabecera(res) || `${radicado}.pdf`;
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
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

export async function conteoPorVacante(token) {
  return apiFetch(`${BASE}/admin/conteo-por-vacante`, { token });
}

export async function descargarReporte(vacanteId, nombreArchivo, token) {
  const res = await apiFetch(`${BASE}/admin/reporte/${vacanteId}`, { token, raw: true });
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo || "reporte.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** Todos los documentos adjuntos de una postulación en un .zip (dueño o Gestión Humana). */
export async function descargarDocumentosZip(radicado, nombreArchivo, token) {
  return descargarDocumentoAdjuntoDesde(`${BASE}/${radicado}/documentos/zip`, nombreArchivo || `${radicado}.zip`, token);
}

export async function descargarDocumentoAdjunto(radicado, categoriaApi, indice, nombreArchivo, token) {
  return descargarDocumentoAdjuntoDesde(`${BASE}/${radicado}/documentos/${categoriaApi}/${indice}`, nombreArchivo, token);
}

async function descargarDocumentoAdjuntoDesde(url, nombreArchivo, token) {
  const res = await apiFetch(url, { token, raw: true });
  const blob = await res.blob();
  const objUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = nombreArchivo || "documento";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objUrl);
}
