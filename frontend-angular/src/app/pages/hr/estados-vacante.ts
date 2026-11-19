export const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  publicada: 'Abierta',
  en_proceso: 'En proceso',
  cerrada: 'Cerrada',
  cancelada_desierta: 'Cancelada/Desierta',
};

export const CLASE_ESTADO: Record<string, string> = {
  borrador: 'vac-status-pill--oculta',
  publicada: 'vac-status-pill--activa',
  en_proceso: 'vac-status-pill--en-proceso',
  cerrada: 'vac-status-pill--cerrada',
  cancelada_desierta: 'vac-status-pill--cancelada',
};

/** [valor, etiqueta] en el mismo orden que Object.entries(ETIQUETA_ESTADO) en React. */
export const OPCIONES_ESTADO = Object.entries(ETIQUETA_ESTADO);
