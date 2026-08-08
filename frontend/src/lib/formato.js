/**
 * Convierte cualquier texto a solo dígitos y lo formatea como pesos
 * colombianos (puntos cada 3 dígitos, sin decimales, sin símbolo $).
 * Ej: "3377598" -> "3.377.598"
 */
export function formatearMilesCOP(valor) {
  const digitos = String(valor).replace(/\D/g, "");
  if (!digitos) return "";
  return Number(digitos).toLocaleString("es-CO");
}
