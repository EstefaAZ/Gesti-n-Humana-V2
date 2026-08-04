// ==========================================================================
// Cliente HTTP genérico — usado por authApi, vacantesApi y solicitudesApi.
// ==========================================================================

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : "Error de la API");
    this.status = status;
    this.detail = detail;
  }
}

/**
 * @param {string} url
 * @param {object} opts
 * @param {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"} [opts.method]
 * @param {string} [opts.token] - JWT, si la ruta lo requiere
 * @param {object} [opts.body] - se serializa como JSON
 * @param {boolean} [opts.raw] - si true, devuelve la Response cruda (para blobs como el PDF)
 */
export async function apiFetch(url, opts = {}) {
  const { method = "GET", token, body, raw = false } = opts;

  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (raw) {
    if (!res.ok) {
      throw new ApiError(res.status, await _leerDetalle(res));
    }
    return res;
  }

  if (res.status === 204) return null;

  const esJson = res.headers.get("content-type")?.includes("application/json");
  const data = esJson ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, data?.detail || data);
  }
  return data;
}

async function _leerDetalle(res) {
  try {
    const data = await res.clone().json();
    return data?.detail || data;
  } catch {
    return res.statusText;
  }
}
