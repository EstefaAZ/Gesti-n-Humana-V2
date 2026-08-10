import { apiFetch } from "./httpClient";
import { API_URLS } from "./config";

const BASE_LOGIN = `${API_URLS.login}/api/v1/notificaciones`;
const BASE_CANDIDATOS = `${API_URLS.candidatos}/api/v1/notificaciones`;

function _notifACamel(n, servicio) {
  return {
    id: n.id,
    servicio, // "login" | "candidatos" — para saber a cuál backend pegarle al marcar leída
    tipo: n.tipo,
    titulo: n.titulo,
    mensaje: n.mensaje,
    leida: n.leida,
    fechaCreacion: n.fecha_creacion,
  };
}

/**
 * Todo usuario (candidato, gestor_humano o admin) puede tener notificaciones
 * de SU PROPIA cuenta en Login (desactivada/reactivada) — eso aplica a
 * cualquier rol por igual. Además, según el rol, Candidatos devuelve las
 * suyas (postulaciones para el candidato, o de difusión para Gestión Humana).
 * Por eso siempre se consultan los 2 servicios y se combinan.
 */
export async function listarTodas(token) {
  const [deLogin, deCandidatos] = await Promise.all([
    apiFetch(`${BASE_LOGIN}/me`, { token }).catch(() => []),
    apiFetch(`${BASE_CANDIDATOS}/me`, { token }).catch(() => []),
  ]);
  const todas = [
    ...deLogin.map((n) => _notifACamel(n, "login")),
    ...deCandidatos.map((n) => _notifACamel(n, "candidatos")),
  ];
  todas.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
  return todas;
}

export async function obtenerConteo(token) {
  const [deLogin, deCandidatos] = await Promise.all([
    apiFetch(`${BASE_LOGIN}/me/conteo`, { token }).catch(() => ({ no_leidas: 0 })),
    apiFetch(`${BASE_CANDIDATOS}/me/conteo`, { token }).catch(() => ({ no_leidas: 0 })),
  ]);
  return (deLogin.no_leidas || 0) + (deCandidatos.no_leidas || 0);
}

export async function marcarLeida(notificacion, token) {
  const base = notificacion.servicio === "login" ? BASE_LOGIN : BASE_CANDIDATOS;
  const data = await apiFetch(`${base}/${notificacion.id}/leida`, { method: "PATCH", token });
  return _notifACamel(data, notificacion.servicio);
}

export async function marcarTodasLeidas(token) {
  await Promise.all([
    apiFetch(`${BASE_LOGIN}/me/marcar-todas-leidas`, { method: "POST", token }).catch(() => {}),
    apiFetch(`${BASE_CANDIDATOS}/me/marcar-todas-leidas`, { method: "POST", token }).catch(() => {}),
  ]);
}
