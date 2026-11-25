import { apiFetch } from "./httpClient";
import { API_URLS } from "./config";
import { deepToCamel } from "./caseConverter";

const BASE = `${API_URLS.candidatos}/api/v1/catalogos`;

export interface NucleoNbc {
  codigo: string;
  nombre: string;
  areaCodigo: string;
  area: string;
}

let cacheNucleos: Promise<NucleoNbc[]> | null = null;

/** Núcleos Básicos del Conocimiento (NBC). Se piden una sola vez por sesión. */
export function listarNucleos(token): Promise<NucleoNbc[]> {
  if (!cacheNucleos) {
    cacheNucleos = apiFetch(`${BASE}/nbc`, { token })
      .then((d) => deepToCamel(d))
      .catch((e) => {
        cacheNucleos = null; // se reintenta la próxima vez
        throw e;
      });
  }
  return cacheNucleos;
}

/** Códigos NBC a los que pertenece un título escrito ("mecánica automotriz" -> ["831"]). */
export async function clasificarTitulo(titulo: string, token): Promise<string[]> {
  const data = await apiFetch(`${BASE}/nbc/clasificar?titulo=${encodeURIComponent(titulo)}`, { token });
  return data?.codigos || [];
}
