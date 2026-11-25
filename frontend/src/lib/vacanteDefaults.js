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
 * descarta `idiomaHabilidad`, que ya no se evalúa. Se aplica al abrir el
 * formulario, así ninguna vacante vieja queda con un selector en blanco.
 */
export function normalizarVacanteParaFormulario(vacante) {
  const criterios = vacante.criterios || {};
  const { idiomaHabilidad: _idiomaHabilidad, ...restoCriterios } = criterios;
  return {
    ...vacante,
    criterios: {
      ...restoCriterios,
      idiomaNivelMin: normalizarNivelIdioma(criterios.idiomaNivelMin) || NIVELES_IDIOMA[0],
    },
  };
}
