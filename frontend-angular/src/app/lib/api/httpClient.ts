// ==========================================================================
// Cliente HTTP genérico — usado por authApi, vacantesApi y solicitudesApi.
// ==========================================================================

export class ApiError extends Error {
  status: number;
  detail: any;

  constructor(status: number, detail: any) {
    super(typeof detail === 'string' ? detail : 'Error de la API');
    this.status = status;
    this.detail = detail;
  }
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

  const esJson = res.headers.get('content-type')?.includes('application/json');
  const data = esJson ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, data?.detail || data);
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
