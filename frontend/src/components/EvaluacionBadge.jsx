export default function EvaluacionBadge({ evaluacion, mostrarMotivos = true }) {
  if (!evaluacion) return null;
  const { cumple, motivos } = evaluacion;

  return (
    <div>
      <span className={`eval-badge ${cumple ? "eval-badge--ok" : "eval-badge--warn"}`}>
        {cumple ? "Cumple criterios" : `No cumple (${motivos.length})`}
      </span>
      {mostrarMotivos && !cumple && motivos.length > 0 && (
        <ul className="eval-motivos">
          {motivos.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
