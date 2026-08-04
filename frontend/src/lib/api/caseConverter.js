// ==========================================================================
// Conversión recursiva snake_case <-> camelCase.
//
// Se usa SOLO para el módulo Vacantes: ahí todo el objeto (incluidos los
// criterios anidados) sigue una única convención de punta a punta, así que
// convertir todo el árbol es seguro.
//
// NO se usa para el módulo Candidatos/Solicitudes: ahí el backend solo
// normaliza las llaves de primer nivel (vacante_id, datos_personales...);
// el CONTENIDO de datosPersonales/registrosII/experiencia se guarda tal cual
// en camelCase porque la evaluación automática del backend ya espera esas
// llaves exactas. Convertir ese contenido recursivamente lo rompería.
// ==========================================================================

function snakeToCamelKey(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camelToSnakeKey(key) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function transformDeep(value, keyFn) {
  if (Array.isArray(value)) {
    return value.map((v) => transformDeep(v, keyFn));
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [keyFn(k), transformDeep(v, keyFn)])
    );
  }
  return value;
}

export function deepToCamel(value) {
  return transformDeep(value, snakeToCamelKey);
}

export function deepToSnake(value) {
  return transformDeep(value, camelToSnakeKey);
}
