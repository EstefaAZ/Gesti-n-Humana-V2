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

/**
 * A dónde debe llevar un clic sobre esta notificación — según el tipo y la
 * entidad asociada. Devuelve null si no hay un destino claro (en ese caso el
 * clic solo marca como leída y no navega a ninguna parte).
 *
 * Se apoya en `entidad_tipo`/`entidad_id`, que las notificaciones ya guardaban;
 * las anteriores al cambio que no los tengan caen al destino genérico de su
 * tipo, así que ninguna queda sin comportamiento.
 */
export async function resolverDestino(notificacion, token) {
  if (notificacion.servicio === "login") {
    // cuenta_desactivada / cuenta_reactivada — es sobre la propia cuenta.
    return "/perfil";
  }

  const radicado = notificacion.entidadTipo === "solicitud" ? notificacion.entidadId : null;

  if (notificacion.tipo === "nueva_postulacion" || notificacion.tipo === "postulacion_retirada") {
    // Difusión para Gestión Humana: abrir la vacante y, dentro, el detalle de
    // esa postulación. La notificación guarda el radicado, no la vacante, así
    // que hay que consultarla para saber a qué vacante pertenece.
    if (!radicado) return "/gestion-humana";
    try {
      const solicitud = await solicitudesApi.obtener(radicado, token);
      return `/gestion-humana?vacante=${solicitud.vacanteId}&radicado=${encodeURIComponent(radicado)}`;
    } catch {
      return "/gestion-humana";
    }
  }

  if (notificacion.tipo === "solicitud_creada" || notificacion.tipo === "estado_cambiado") {
    // Sobre la propia postulación del candidato — no hay página de detalle
    // individual, así que se resalta su fila en "Mis postulaciones".
    return radicado ? `/mis-postulaciones?radicado=${encodeURIComponent(radicado)}` : "/mis-postulaciones";
  }

  return null;
}
