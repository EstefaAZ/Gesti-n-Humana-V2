import { apiFetch } from "./httpClient";
import { API_URLS } from "./config";
import * as solicitudesApi from "./solicitudesApi";

const BASE_LOGIN = `${API_URLS.login}/api/v1/notificaciones`;
const BASE_CANDIDATOS = `${API_URLS.candidatos}/api/v1/notificaciones`;

function _notifACamel(n, servicio) {
  return {
    id: n.id,
    servicio, // "login" | "candidatos" — para saber a cuál backend pegarle al marcar leída
    tipo: n.tipo,
    titulo: n.titulo,
    mensaje: n.mensaje,
    entidadTipo: n.entidad_tipo || null,
    entidadId: n.entidad_id || null,
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
  todas.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
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

// Notificaciones de difusión para Gestión Humana sobre una postulación: llevan al
// proceso y abren el panel de ese candidato.
const TIPOS_GESTION_SOBRE_POSTULACION = ["nueva_postulacion", "postulacion_retirada", "certificados_adjuntados"];
// Notificaciones del candidato sobre su propia postulación: llevan a "Mis
// postulaciones" con esa postulación resaltada (ahí también adjunta certificados).
const TIPOS_CANDIDATO_SOBRE_POSTULACION = ["solicitud_creada", "estado_cambiado", "certificados_solicitados"];

async function destinoGestion(radicado, token) {
  // La notificación guarda el radicado, no la vacante: se consulta para saber a cuál pertenece.
  if (!radicado) return "/gestion-humana";
  try {
    const solicitud = await solicitudesApi.obtener(radicado, token);
    return `/gestion-humana?vacante=${solicitud.vacanteId}&radicado=${encodeURIComponent(radicado)}`;
  } catch {
    return "/gestion-humana";
  }
}

function destinoCandidato(radicado) {
  return radicado ? `/mis-postulaciones?radicado=${encodeURIComponent(radicado)}` : "/mis-postulaciones";
}

/**
 * A dónde debe llevar un clic sobre esta notificación, según su tipo y la
 * entidad asociada. `esGestion` decide el destino de un tipo nuevo que se
 * refiera a una postulación y todavía no esté en las listas de arriba.
 * Devuelve null si no hay un destino claro (el clic solo la marca como leída).
 */
export async function resolverDestino(notificacion, token, esGestion = false) {
  if (notificacion.servicio === "login") {
    // cuenta_desactivada / cuenta_reactivada: siempre son sobre la propia cuenta.
    return "/perfil";
  }

  const radicado = notificacion.entidadTipo === "solicitud" ? notificacion.entidadId : null;

  if (TIPOS_GESTION_SOBRE_POSTULACION.includes(notificacion.tipo)) return destinoGestion(radicado, token);
  if (TIPOS_CANDIDATO_SOBRE_POSTULACION.includes(notificacion.tipo)) return destinoCandidato(radicado);

  // Tipo nuevo que apunta a una postulación: según quién la está viendo.
  if (radicado) return esGestion ? destinoGestion(radicado, token) : destinoCandidato(radicado);
  return null;
}
