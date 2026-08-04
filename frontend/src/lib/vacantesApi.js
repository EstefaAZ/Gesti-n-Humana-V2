import { apiFetch, ApiError } from "./httpClient";
import { API_URLS } from "./config";
import { deepToCamel, deepToSnake } from "./caseConverter";

const BASE = `${API_URLS.vacantes}/api/v1/vacantes`;

export const ESTADOS_VACANTE = ["borrador", "publicada", "en_proceso", "cerrada", "cancelada_desierta"];

export async function listarPublicas() {
  const data = await apiFetch(BASE);
  return deepToCamel(data);
}

export async function obtenerPublica(id) {
  const data = await apiFetch(`${BASE}/${id}`);
  return deepToCamel(data);
}

export async function listarAdmin(token) {
  const data = await apiFetch(`${BASE}/admin/todas`, { token });
  return deepToCamel(data);
}

export async function obtenerAdmin(id, token) {
  const data = await apiFetch(`${BASE}/admin/${id}`, { token });
  return deepToCamel(data);
}

export async function crear(vacanteCamel, token) {
  const data = await apiFetch(BASE, { method: "POST", token, body: deepToSnake(vacanteCamel) });
  return deepToCamel(data);
}

export async function actualizar(id, vacanteCamel, token) {
  const data = await apiFetch(`${BASE}/${id}`, { method: "PUT", token, body: deepToSnake(vacanteCamel) });
  return deepToCamel(data);
}

export async function cambiarEstado(id, estado, token) {
  const data = await apiFetch(`${BASE}/${id}/estado`, { method: "PATCH", token, body: { estado } });
  return deepToCamel(data);
}

export async function eliminar(id, token) {
  await apiFetch(`${BASE}/${id}`, { method: "DELETE", token });
}

export async function obtenerEstadisticas(token) {
  const data = await apiFetch(`${BASE}/admin/estadisticas`, { token });
  return deepToCamel(data);
}

export async function obtenerAuditoria(token, limite = 100) {
  const data = await apiFetch(`${BASE}/admin/auditoria/eventos?limite=${limite}`, { token });
  return deepToCamel(data);
}

// ---- Documento PDF de la vacante (formato oficial de convocatoria) ----

export async function subirDocumentoPdf(id, archivo, token) {
  const formData = new FormData();
  formData.append("archivo", archivo);
  const res = await fetch(`${BASE}/${id}/documento`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.detail || "No se pudo subir el documento.");
  return deepToCamel(data);
}

export function urlDocumentoPdf(id) {
  return `${BASE}/${id}/documento`;
}
