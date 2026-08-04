import { Link } from "react-router-dom";

export default function Confirmacion({ radicado, onDescargarPdf }) {
  return (
    <section className="confirmation">
      <div className="confirmation__badge">✓</div>
      <h2 className="section-title text-center">Solicitud recibida</h2>
      <p className="text-muted">
        Su solicitud ha sido registrada correctamente. Guarde este número de radicado para consultar el estado de su proceso.
      </p>
      <div className="confirmation__radicado">{radicado}</div>
      <div className="confirmation__actions">
        <button type="button" className="btn btn-primary" onClick={onDescargarPdf}>
          Descargar PDF de mi solicitud
        </button>
        <Link to="/mis-postulaciones" className="btn btn-secondary">Ver mis postulaciones</Link>
      </div>
    </section>
  );
}
