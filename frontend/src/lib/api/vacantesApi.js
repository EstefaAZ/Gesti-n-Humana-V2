import { apiFetch } from "./httpClient";
import { API_URLS } from "./config";
import { deepToCamel, deepToSnake } from "./caseConverter";

const BASE = `${API_URLS.vacantes}/api/v1/vacantes`;

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

export async function toggleActiva(id, token) {
  const data = await apiFetch(`${BASE}/${id}/toggle-activa`, { method: "PATCH", token });
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
