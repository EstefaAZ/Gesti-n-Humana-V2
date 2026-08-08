import { apiFetch } from "./httpClient";
import { API_URLS } from "./config";

const BASE = `${API_URLS.candidatos}/api/v1/perfiles`;

function _documentosACamel(d) {
  if (!d) return { cedula: [], certificadosLaborales: [], certificadosEstudio: [], tarjetaProfesional: [] };
  return {
    cedula: d.cedula || [],
    certificadosLaborales: d.certificados_laborales || [],
    certificadosEstudio: d.certificados_estudio || [],
    tarjetaProfesional: d.tarjeta_profesional || [],
  };
}

function _perfilACamel(p) {
  if (!p) return p;
  return {
    usuarioId: p.usuario_id,
    datosPersonales: p.datos_personales,
    registrosII: p.registros_ii,
    experiencia: p.experiencia,
    conflicto: p.conflicto,
    documentosAdjuntos: _documentosACamel(p.documentos_adjuntos),
    autorizacion: {
      acepta: p.autorizacion?.acepta,
      nombreCompleto: p.autorizacion?.nombre_completo,
    },
    completado: p.completado,
    fechaCreacion: p.fecha_creacion,
    fechaActualizacion: p.fecha_actualizacion,
  };
}

function _documentosASnake(lista) {
  return (lista || []).map((d) => ({ nombre: d.nombre, contenido_base64: d.contenidoBase64 }));
}

export async function obtenerEstado(token) {
  // { existe: bool, completado: bool }
  return apiFetch(`${BASE}/me/estado`, { token });
}

export async function obtenerMiPerfil(token) {
  const data = await apiFetch(`${BASE}/me`, { token });
  return _perfilACamel(data);
}

export async function guardarPerfil(perfilCamel, token) {
  const body = {
    datos_personales: perfilCamel.datosPersonales,
    registros_ii: perfilCamel.registrosII,
    experiencia: perfilCamel.experiencia,
    conflicto: perfilCamel.conflicto,
    documentos_adjuntos: {
      cedula: _documentosASnake(perfilCamel.documentosAdjuntos?.cedula),
      certificados_laborales: _documentosASnake(perfilCamel.documentosAdjuntos?.certificadosLaborales),
      certificados_estudio: _documentosASnake(perfilCamel.documentosAdjuntos?.certificadosEstudio),
      tarjeta_profesional: _documentosASnake(perfilCamel.documentosAdjuntos?.tarjetaProfesional),
    },
    autorizacion: {
      acepta: perfilCamel.autorizacion?.acepta,
      nombre_completo: perfilCamel.autorizacion?.nombreCompleto,
    },
  };
  const data = await apiFetch(`${BASE}/me`, { method: "PUT", token, body });
  return _perfilACamel(data);
}

async function _descargarArchivo(url, nombreArchivo, token) {
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

export async function descargarMiDocumento(categoriaApi, indice, nombreArchivo, token) {
  return _descargarArchivo(`${BASE}/me/documentos/${categoriaApi}/${indice}`, nombreArchivo, token);
}

export async function descargarDocumentoDeCandidato(usuarioId, categoriaApi, indice, nombreArchivo, token) {
  return _descargarArchivo(`${BASE}/admin/${usuarioId}/documentos/${categoriaApi}/${indice}`, nombreArchivo, token);
}

export async function listarTodos(token) {
  const data = await apiFetch(`${BASE}/admin/todos`, { token });
  return data.map(_perfilACamel);
}
