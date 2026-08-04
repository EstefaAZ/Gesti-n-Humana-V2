export default function Field({ label, error, span2, hint, children }) {
  return (
    <div className={`field ${span2 ? "field--span2" : ""} ${error ? "is-invalid" : ""}`}>
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
