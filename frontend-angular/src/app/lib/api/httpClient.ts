// ==========================================================================
// Cliente HTTP genérico — usado por authApi, vacantesApi y solicitudesApi.
// ==========================================================================

export class ApiError extends Error {
  status: number;
  /** Mensaje en español, listo para mostrar (nunca un objeto). */
  detail: string;
  /** Errores por campo del body (validación 422 de FastAPI), ej. { email: 'El correo electrónico no es válido.' } */
  campos: Record<string, string>;
  /** Respuesta original del servidor, por si alguna pantalla necesita más detalle. */
  crudo: any;

  constructor(status: number, detail: any) {
    const { mensaje, campos } = _normalizarDetalle(status, detail);
    super(mensaje);
    this.status = status;
    this.detail = mensaje;
    this.campos = campos;
    this.crudo = detail;
  }
}

const NOMBRES_CAMPO: Record<string, string> = {
  email: 'correo electrónico',
  password: 'contraseña',
  password_nueva: 'contraseña nueva',
  password_actual: 'contraseña actual',
  nombre_completo: 'nombre',
  cedula: 'número de documento',
};

/** Traduce un error de validación de Pydantic (FastAPI 422) a un mensaje en español. */
function _mensajeValidacion(e: any): string {
  const ctx = e?.ctx || {};
  switch (e?.type) {
    case 'missing':
      return 'Este dato es obligatorio.';
    case 'string_too_short':
      return `Es demasiado corto (mínimo ${ctx.min_length} caracteres).`;
    case 'string_too_long':
      return `Es demasiado largo (máximo ${ctx.max_length} caracteres).`;
    case 'value_error':
      if (e?.loc?.at(-1) === 'email') return 'El correo electrónico no es válido.';
      // Validadores propios del backend (ej. política de contraseña): el texto ya viene en español.
      return String(e?.msg || '').replace(/^Value error,\s*/i, '') || 'Este dato no es válido.';
    default:
      return 'Este dato no es válido.';
  }
}

function _normalizarDetalle(status: number, detail: any): { mensaje: string; campos: Record<string, string> } {
  const campos: Record<string, string> = {};
  // Los textos de error de la API ya vienen en español. Se exceptúan los 5xx (el servidor
  // responde "Internal Server Error" en texto plano) y las páginas HTML de un proxy.
  if (typeof detail === 'string' && detail.trim() && status < 500 && !detail.trim().startsWith('<')) {
    return { mensaje: detail, campos };
  }

  if (Array.isArray(detail)) {
    for (const e of detail) {
      const campo = String(e?.loc?.at(-1) ?? '');
      if (campo && !campos[campo]) campos[campo] = _mensajeValidacion(e);
    }
    const partes = Object.entries(campos).map(([c, m]) => `${NOMBRES_CAMPO[c] ? `${NOMBRES_CAMPO[c][0].toUpperCase()}${NOMBRES_CAMPO[c].slice(1)}: ` : ''}${m}`);
    return { mensaje: partes.length ? partes.join(' ') : 'Revisa los datos ingresados.', campos };
  }

  if (status === 429) {
    return { mensaje: 'Hiciste demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.', campos };
  }
  if (status === 0) {
    return { mensaje: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', campos };
  }
  if (status >= 500) {
    return { mensaje: 'Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.', campos };
  }
  return { mensaje: 'No se pudo completar la operación. Inténtalo de nuevo.', campos };
}

// --- Sesión vencida o token inválido -------------------------------------
// Las dependencias de los 3 backends responden 401 con este texto exacto cuando
// el token no sirve (vencido, mal firmado…). OJO: no todo 401 es eso — cambiar
// la contraseña con la actual equivocada también da 401 ("Correo o contraseña
// incorrectos.") y ahí NO hay que cerrar la sesión.
const SESION_INVALIDA = /no se pudo validar la sesi[oó]n|not authenticated/i;

let alExpirar: (() => void) | null = null;

/** AuthService registra aquí qué hacer cuando el servidor rechaza el token. */
export function alExpirarSesion(fn: () => void): void {
  alExpirar = fn;
}

function _error(status: number, detail: any, token?: string | null): ApiError {
  if (status === 401 && token && typeof detail === 'string' && SESION_INVALIDA.test(detail)) {
    alExpirar?.();
  }
  return new ApiError(status, detail);
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JWT, si la ruta lo requiere */
  token?: string | null;
  /** se serializa como JSON */
  body?: any;
  /** si true, devuelve la Response cruda (para blobs como el PDF) */
  raw?: boolean;
}

export async function apiFetch(url: string, opts: ApiFetchOptions = {}): Promise<any> {
  const { method = 'GET', token, body, raw = false } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Sin red, servidor apagado o bloqueado por CORS: fetch no devuelve respuesta.
    throw new ApiError(0, null);
  }

  if (raw) {
    if (!res.ok) {
      throw _error(res.status, await _leerDetalle(res), token);
    }
    return res;
  }

  if (res.status === 204) return null;

  const esJson = res.headers.get('content-type')?.includes('application/json');
  const data = esJson ? await res.json() : await res.text();

  if (!res.ok) {
    throw _error(res.status, data?.detail || data, token);
  }
  return data;
}

async function _leerDetalle(res: Response): Promise<any> {
  try {
    const data = await res.clone().json();
    return data?.detail || data;
  } catch {
    return res.statusText;
  }
}

/** Descarga un blob como archivo (mismo truco del <a download> que usaba React). */
export async function descargarBlob(res: Response, nombreArchivo: string): Promise<void> {
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
