import RegistroIICard from "./RegistroIICard";

const MAX_REGISTROS = 15;

export default function HojaII({ registros, onAdd, onRemove, onChange }) {
  return (
    <section>
      <h2 className="section-title">II. Estudios, Cursos, Certificaciones e Idiomas</h2>
      <p className="section-intro">
        Agregue un registro por cada estudio, curso, certificación o idioma que desee declarar. Puede agregar hasta
        15 registros y eliminar cualquiera que haya agregado por error. Si necesita registrar más de 15, contacte a
        Gestión Humana para anexar la información adicional.
      </p>

      {registros.length === 0 && (
        <div className="empty-state">Aún no ha agregado ningún registro. Use el botón de abajo para comenzar.</div>
      )}

      {registros.map((r, i) => (
        <RegistroIICard key={r.id} registro={r} index={i} onChange={onChange} onRemove={onRemove} />
      ))}

      <button type="button" className="btn btn-add btn-block" disabled={registros.length >= MAX_REGISTROS} onClick={onAdd}>
        + Agregar registro
      </button>
      <p className={`limit-note ${registros.length >= MAX_REGISTROS ? "is-at-max" : ""}`}>
        {registros.length} de {MAX_REGISTROS} registros agregados.
      </p>
    </section>
  );
}
