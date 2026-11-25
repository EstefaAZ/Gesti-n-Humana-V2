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

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * "2026-12-14" -> "14/12/2026". Se arma la fecha en hora local (no con
 * new Date("2026-12-14"), que la toma como UTC y en Colombia mostraría el día
 * anterior). Si no es una fecha válida, la devuelve tal cual.
 */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!m) return valor;
  return FORMATO_FECHA.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
