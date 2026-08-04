// Departamentos: ver src/data/municipiosPorDepartamento.js (datos oficiales DIVIPOLA)

export const PARENTESCOS = [
  "Cónyuge o compañero permanente", "Padre", "Hijo", "Abuelo", "Nieto", "Hermano",
  "Tío", "Primo", "Sobrino", "Suegro", "Cuñado", "Nuera o yerno", "Hijo y/o padre por adopción",
];

export const TIPO_REGISTRO_LABELS = {
  estudio: "Estudio formal",
  educacionTrabajo: "Educación para el trabajo y el desarrollo humano",
  certificacion: "Certificaciones y matrículas",
  idioma: "Idioma",
};

// Mismas opciones usadas en el Registro II (Hoja II) — se reutilizan para
// definir los criterios de evaluación de una vacante.
export const NIVELES_EDUCATIVOS = ["Secundarios", "Técnico", "Tecnólogo", "Universitario", "Postgrado"];
export const NIVEL_EDUCATIVO_ORDER = { "": 0, Secundarios: 1, Técnico: 2, Tecnólogo: 3, Universitario: 4, Postgrado: 5 };

export const NIVELES_IDIOMA = ["Regular", "Bien", "Muy bien"];
export const NIVEL_IDIOMA_ORDER = { "": 0, Regular: 1, Bien: 2, "Muy bien": 3 };

export const TIPOS_VINCULACION = ["Término fijo", "Término indefinido", "Prestación de servicios", "Aprendizaje SENA"];
export const PUBLICO_OBJETIVO_OPCIONES = ["Interno", "Externo", "Ambos"];

