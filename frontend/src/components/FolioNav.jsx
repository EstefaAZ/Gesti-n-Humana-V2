const STEP_LABELS = {
  I: "Datos personales",
  II: "Estudios",
  VI: "Experiencia",
  VII: "Conflicto de interés",
  VIII: "Autorización",
  DOCS: "Documentos",
};

export default function FolioNav({ steps, activeStep, doneSteps }) {
  return (
    <div className="folio-nav">
      {steps.map((step) => (
        <div
          key={step}
          className={`folio-tab ${step === activeStep ? "is-active" : ""} ${doneSteps.includes(step) ? "is-done" : ""}`}
        >
          <span className="folio-tab__numeral">{step}</span>
          <span className="folio-tab__label">{STEP_LABELS[step]}</span>
        </div>
      ))}
    </div>
  );
}
