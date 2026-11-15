// Departamentos: ver src/data/municipiosPorDepartamento.js (datos oficiales DIVIPOLA)

export const PARENTESCOS = [
  "Cónyuge o compañero(a) permanente", "Madre", "Padre", "Hijo(a)", "Abuelo(a)", "Nieto(a)", "Hermano(a)",
  "Tío(a)", "Primo(a)", "Sobrino(a)", "Suegro(a)", "Cuñado(a)", "Nuera o yerno", "Hijo(a) y/o padre por adopción",
];

export const TIPO_REGISTRO_LABELS: Record<string, string> = {
  estudio: "Estudio formal",
  educacionTrabajo: "Educación para el trabajo y el desarrollo humano",
  certificacion: "Certificaciones y matrículas",
  idioma: "Idioma",
};

// Mismas opciones usadas en el Registro II (Hoja II) — se reutilizan para
// definir los criterios de evaluación de una vacante.
export const NIVELES_EDUCATIVOS = ["Secundarios", "Técnico", "Tecnólogo", "Universitario", "Postgrado"];
export const NIVEL_EDUCATIVO_ORDER: Record<string, number> = { "": 0, Secundarios: 1, Técnico: 2, Tecnólogo: 3, Universitario: 4, Postgrado: 5 };

// Escala única de dominio del idioma. Reemplaza a la valoración subjetiva por
// habilidad ("Lo habla / Lo lee / Lo escribe" con Regular/Bien/Muy bien): un
// solo nivel, ordenable, y anclado al Marco Común Europeo (MCER) para que
// candidato y Gestión Humana lo interpreten igual.
export const NIVELES_IDIOMA = ["Básico", "Intermedio", "Avanzado", "Experto"];
export const NIVEL_IDIOMA_ORDER: Record<string, number> = { "": 0, "Básico": 1, "Intermedio": 2, "Avanzado": 3, "Experto": 4 };

export const NIVEL_IDIOMA_MCER: Record<string, string> = {
  "Básico": "A1–A2",
  "Intermedio": "B1",
  "Avanzado": "B2–C1",
  "Experto": "C2 / nativo",
};

/** "Avanzado" → "Avanzado (B2–C1)". Para las etiquetas de los selectores y las fichas. */
export function etiquetaNivelIdioma(nivel) {
  const mcer = NIVEL_IDIOMA_MCER[nivel];
  return mcer ? `${nivel} (${mcer})` : nivel || "—";
}

// Catálogo de idiomas — se usa con SelectConOtro, así que no es una lista
// cerrada: cualquier idioma fuera de esta lista se sigue pudiendo escribir
// libremente (opción "Otro"). El nivel de dominio (arriba) es independiente
// del idioma elegido, siempre se evalúa con la misma escala.
export const IDIOMAS = [
  "Español", "Inglés", "Francés", "Portugués", "Alemán", "Italiano",
  "Mandarín", "Japonés", "Coreano", "Árabe", "Ruso", "Neerlandés",
];

// Escala anterior. Solo se usa para LEER registros y vacantes creados antes del
// cambio: nada nuevo se guarda con estos valores.
const NIVEL_IDIOMA_ANTERIOR: Record<string, string> = { Regular: "Básico", Bien: "Intermedio", "Muy bien": "Avanzado" };
const HABILIDADES_ANTERIORES = ["habla", "lee", "escribe"];

/** Traduce un nivel de la escala anterior a la nueva; deja pasar los ya válidos. */
export function normalizarNivelIdioma(valor) {
  if (!valor) return "";
  return NIVEL_IDIOMA_ANTERIOR[valor] || (NIVEL_IDIOMA_ORDER[valor] ? valor : "");
}

/**
 * Nivel de un registro de idioma del Registro II. Prefiere el campo nuevo
 * (`nivel`); si el registro es antiguo, toma la mejor de las tres habilidades
 * — es la lectura más justa para el candidato, que no eligió esta migración.
 */
export function nivelDeRegistroIdioma(registro) {
  const nuevo = normalizarNivelIdioma(registro?.nivel);
  if (nuevo) return nuevo;
  let mejor = "";
  for (const habilidad of HABILIDADES_ANTERIORES) {
    const nivel = normalizarNivelIdioma(registro?.[habilidad]);
    if (NIVEL_IDIOMA_ORDER[nivel] > NIVEL_IDIOMA_ORDER[mejor]) mejor = nivel;
  }
  return mejor;
}

/** Campos de la escala anterior, para limpiarlos cuando el registro se actualiza. */
export const CAMPOS_IDIOMA_ANTERIORES = HABILIDADES_ANTERIORES;

/** Resumen de una fila del Registro II para las tablas de Gestión Humana. */
export function detalleRegistroII(registro) {
  if (registro.tipo === "idioma") {
    const nivel = nivelDeRegistroIdioma(registro);
    return [registro.idioma, nivel && etiquetaNivelIdioma(nivel)].filter(Boolean).join(" — ") || "—";
  }
  return registro.titulo || registro.nombreEvento || registro.nombreNorma || registro.idioma || "—";
}

export const TIPOS_VINCULACION = ["Término fijo", "Término indefinido", "Prestación de servicios", "Aprendizaje SENA"];
export const PUBLICO_OBJETIVO_OPCIONES = ["Interno", "Externo", "Ambos"];

