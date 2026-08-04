import { apiFetch } from "./httpClient";
import { API_URLS } from "./config";

const BASE = `${API_URLS.login}/api/v1/auth`;

export async function registrar({ nombreCompleto, email, password, cedula }) {
  const usuario = await apiFetch(`${BASE}/registro`, {
    method: "POST",
    body: { nombre_completo: nombreCompleto, email, password, cedula: cedula || undefined },
  });
  return _usuarioACamel(usuario);
}

export async function login(email, password, recordar = false) {
  const data = await apiFetch(`${BASE}/login`, { method: "POST", body: { email, password, recordar } });
  return { token: data.access_token, usuario: _usuarioACamel(data.usuario) };
}

export async function olvidePassword(email) {
  // Devuelve el mensaje genérico; en desarrollo puede incluir token_dev para poder probar el flujo sin correo real.
  return apiFetch(`${BASE}/olvide-password`, { method: "POST", body: { email } });
}

export async function restablecerPassword(token, passwordNueva) {
  await apiFetch(`${BASE}/restablecer-password`, {
    method: "POST",
    body: { token, password_nueva: passwordNueva },
  });
}

export async function obtenerPerfil(token) {
  const usuario = await apiFetch(`${BASE}/me`, { token });
  return _usuarioACamel(usuario);
}

export async function actualizarPerfil({ nombreCompleto, email }, token) {
  const body = {};
  if (nombreCompleto) body.nombre_completo = nombreCompleto;
  if (email) body.email = email;
  const usuario = await apiFetch(`${BASE}/me`, { method: "PATCH", token, body });
  return _usuarioACamel(usuario);
}

export async function cambiarPassword(passwordActual, passwordNueva, token) {
  await apiFetch(`${BASE}/me/password`, {
    method: "PATCH",
    token,
    body: { password_actual: passwordActual, password_nueva: passwordNueva },
  });
}

export async function eliminarCuenta(token) {
  await apiFetch(`${BASE}/me`, { method: "DELETE", token });
}

// NOTA: este endpoint (PATCH /me/desactivar) aún no existe en el backend de auth
// que se compartió; hay que agregarlo allá (setear activo=false, igual que el
// campo que ya devuelve /me y /usuarios). Se deja aquí siguiendo el mismo patrón
// que cambiarPassword/eliminarCuenta para no bloquear el frontend.
export async function desactivarCuenta(token) {
  await apiFetch(`${BASE}/me/desactivar`, { method: "PATCH", token });
}

export async function obtenerEstadisticas(token) {
  const data = await apiFetch(`${BASE}/estadisticas`, { token });
  return {
    total: data.total,
    porRol: data.por_rol,
    recientes: data.recientes.map(_usuarioACamel),
  };
}

export async function listarUsuarios(token) {
  const data = await apiFetch(`${BASE}/usuarios`, { token });
  return data.map(_usuarioACamel);
}

export async function crearUsuarioInterno({ nombreCompleto, email, password, rol }, token) {
  const usuario = await apiFetch(`${BASE}/usuarios-internos`, {
    method: "POST",
    token,
    body: { nombre_completo: nombreCompleto, email, password, rol },
  });
  return _usuarioACamel(usuario);
}

export async function cambiarRol(usuarioId, nuevoRol, token) {
  const usuario = await apiFetch(`${BASE}/usuarios/${usuarioId}/rol`, {
    method: "PATCH",
    token,
    body: { rol: nuevoRol },
  });
  return _usuarioACamel(usuario);
}

export async function obtenerAuditoria(token, limite = 100) {
  const data = await apiFetch(`${BASE}/auditoria?limite=${limite}`, { token });
  return data.map(_eventoACamel);
}

function _eventoACamel(e) {
  return {
    id: e.id,
    tipo: e.tipo,
    descripcion: e.descripcion,
    actorNombre: e.actor_nombre,
    actorRol: e.actor_rol,
    entidadTipo: e.entidad_tipo,
    entidadId: e.entidad_id,
    fecha: e.fecha,
  };
}

function _usuarioACamel(u) {
  if (!u) return u;
  return {
    id: u.id,
    nombreCompleto: u.nombre_completo,
    email: u.email,
    rol: u.rol,
    cedula: u.cedula,
    activo: u.activo,
    fechaCreacion: u.fecha_creacion,
  };
}
