import ExperienciaCard from "./ExperienciaCard";

const MAX_EXPERIENCIAS = 10;

export default function HojaVI({ experiencias, onAdd, onRemove, onChange }) {
  return (
    <section>
      <h2 className="section-title">VI. Experiencia Laboral</h2>
      <p className="section-intro">
        Use el botón "Agregar otra experiencia laboral" tantas veces como necesite para registrar todas sus
        experiencias (máximo 10). Durante el proceso de selección, Aguas Nacionales EPM S.A E.S.P. solicitará
        certificación escrita, con descripción de funciones, de la empresa para la cual usted trabajó — describa
        únicamente experiencias relacionadas con el cargo al que aspira y absténgase de describir cargos y funciones
        que no puedan ser certificadas. Si en una misma empresa ha laborado en varios cargos, regístrelos por separado.
      </p>

      {experiencias.length === 0 && (
        <div className="empty-state">Aún no ha agregado ninguna experiencia laboral.</div>
      )}

      {experiencias.map((exp, i) => (
        <ExperienciaCard key={exp.id} experiencia={exp} index={i} onChange={onChange} onRemove={onRemove} />
      ))}

      <button type="button" className="btn btn-add btn-block" disabled={experiencias.length >= MAX_EXPERIENCIAS} onClick={onAdd}>
        + Agregar otra experiencia laboral
      </button>
      <p className={`limit-note ${experiencias.length >= MAX_EXPERIENCIAS ? "is-at-max" : ""}`}>
        {experiencias.length} de {MAX_EXPERIENCIAS} experiencias agregadas.
      </p>
    </section>
  );
}
