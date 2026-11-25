import { NIVELES_IDIOMA, normalizarNivelIdioma } from "../data/catalogos";

// El backend genera el id al crear la vacante, así que un borrador nuevo no lo trae.
export function vacanteVacia() {
  return {
    procesoNo: "",
    cargo: "",
    descripcion: "",
    area: "",
    salario: "",
    tipoVinculacion: "",
    sede: "",
    plazas: 1,
    fechaApertura: "",
    fechaCierre: "",
    horaCierre: "16:00",
    publicoObjetivo: "Externo",
    conocimientosComplementarios: "",
    requisitosObligatorios: "",
    estado: "publicada",
    criterios: {
      nivelEducativoMin: "",
      graduadoRequerido: true,
      profesionKeyword: "",
      titulosAceptados: [],
      aceptaAfines: true,
      nbcAfines: [],
      experienciaMinAnios: "",
      idiomaRequerido: "",
      idiomaNivelMin: "Básico",
      certificacionesKeywords: [],
    },
  };
}

/**
 * Deja una vacante existente lista para editarse con los criterios actuales:
 * traduce el nivel de idioma de la escala anterior (Regular/Bien/Muy bien) y
 * descarta `idiomaHabilidad`, que ya no se evalúa, y convierte la palabra clave
 * de profesión anterior en un título aceptado. Se aplica al abrir el
 * formulario, así ninguna vacante vieja queda con un selector en blanco.
 */
/** Títulos que pide la vacante; en vacantes viejas, la palabra clave única de profesión. */
export function titulosAceptadosDe(criterios: any): string[] {
  const titulos = (criterios?.titulosAceptados || []).map((t: string) => String(t).trim()).filter(Boolean);
  if (titulos.length) return titulos;
  const anterior = String(criterios?.profesionKeyword || '').trim();
  return anterior ? [anterior] : [];
}

export function normalizarVacanteParaFormulario(vacante) {
  const criterios: any = vacante.criterios || {};
  const { idiomaHabilidad: _idiomaHabilidad, ...restoCriterios } = criterios;
  return {
    ...vacante,
    criterios: {
      ...restoCriterios,
      idiomaNivelMin: normalizarNivelIdioma(criterios.idiomaNivelMin) || NIVELES_IDIOMA[0],
      // Antes había una sola palabra clave de profesión; pasa a ser el primer título aceptado.
      titulosAceptados: criterios.titulosAceptados?.length
        ? criterios.titulosAceptados
        : String(criterios.profesionKeyword || '').trim()
          ? [criterios.profesionKeyword.trim()]
          : [],
      aceptaAfines: criterios.aceptaAfines ?? false,
      nbcAfines: criterios.nbcAfines || [],
    },
  };
}
