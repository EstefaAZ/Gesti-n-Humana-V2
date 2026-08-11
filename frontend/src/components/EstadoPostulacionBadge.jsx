const CLASE_POR_ESTADO = {
  "Recibida": "estado-badge--recibida",
  "En revisión": "estado-badge--en-revision",
  "Preseleccionado": "estado-badge--preseleccionado",
  "Entrevista programada": "estado-badge--entrevista",
  "Rechazada": "estado-badge--rechazada",
  "Aceptada": "estado-badge--aceptada",
  "Retirada": "estado-badge--retirada",
};

export default function EstadoPostulacionBadge({ estado }) {
  return (
    <span className={`estado-badge ${CLASE_POR_ESTADO[estado] || "estado-badge--recibida"}`}>
      {estado}
    </span>
  );
}
