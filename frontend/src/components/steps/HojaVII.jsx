import { PARENTESCOS } from "../../data/catalogos";

const MAX_FAMILIARES = 5;

export default function HojaVII({ conflicto, setConflicto, onAddFamiliar, onRemoveFamiliar, onChangeFamiliar, errors }) {
  const setVinculo = (val) => {
    if (val === "si") {
      setConflicto({ tieneVinculo: val });
    } else {
      setConflicto({ tieneVinculo: val, familiares: [] });
    }
  };

  return (
    <section>
      <h2 className="section-title">VII. Declaración Conflicto de Interés</h2>

      <div className="field" style={{ marginBottom: 20 }}>
        <label>
          ¿Tiene algún vínculo con empleados o miembros de la Junta Directiva de Aguas Nacionales EPM (cónyuge o
          compañero permanente, padre, hijo, abuelo, nieto, hermano, tío, primo, sobrino, suegro, cuñado, nuera o
          yerno, hijo y/o padre por adopción)? *
        </label>
        <div className="radio-row">
          <label className="radio-option">
            <input type="radio" name="tieneVinculo" checked={conflicto.tieneVinculo === "si"} onChange={() => setVinculo("si")} /> Sí
          </label>
          <label className="radio-option">
            <input type="radio" name="tieneVinculo" checked={conflicto.tieneVinculo === "no"} onChange={() => setVinculo("no")} /> No
          </label>
        </div>
      </div>

      {conflicto.tieneVinculo === "si" && (
        <div>
          {conflicto.familiares.length === 0 && (
            <div className="empty-state">Aún no ha agregado ningún familiar.</div>
          )}
          {conflicto.familiares.length > 0 && (
            <table className="plain-table">
              <thead>
                <tr>
                  <th>Parentesco / relación</th>
                  <th>Nombre del empleado</th>
                  <th>Cargo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {conflicto.familiares.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <select value={f.parentesco} onChange={(e) => onChangeFamiliar(f.id, { parentesco: e.target.value })}>
                        <option value="">Seleccione…</option>
                        {PARENTESCOS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="text" value={f.nombreEmpleado} onChange={(e) => onChangeFamiliar(f.id, { nombreEmpleado: e.target.value })} />
                    </td>
                    <td>
                      <input type="text" value={f.cargo} onChange={(e) => onChangeFamiliar(f.id, { cargo: e.target.value })} />
                    </td>
                    <td>
                      <button type="button" className="repeatable-block__remove" onClick={() => onRemoveFamiliar(f.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" className="btn btn-add btn-block" disabled={conflicto.familiares.length >= MAX_FAMILIARES} onClick={onAddFamiliar}>
            + Agregar otro familiar
          </button>
          <p className={`limit-note ${conflicto.familiares.length >= MAX_FAMILIARES ? "is-at-max" : ""}`}>
            {conflicto.familiares.length} de {MAX_FAMILIARES} familiares agregados.
          </p>
          {errors.familiares && <p className="field-error" style={{ display: "block" }}>{errors.familiares}</p>}
        </div>
      )}

      <div className="field" style={{ margin: "28px 0 16px" }}>
        <label>¿Tiene alguna otra inhabilidad, incompatibilidad o conflicto de interés que deba declarar? *</label>
        <div className="radio-row">
          <label className="radio-option">
            <input
              type="radio"
              name="tieneOtraInhabilidad"
              checked={conflicto.tieneOtraInhabilidad === "si"}
              onChange={() => setConflicto({ tieneOtraInhabilidad: "si" })}
            /> Sí
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="tieneOtraInhabilidad"
              checked={conflicto.tieneOtraInhabilidad === "no"}
              onChange={() => setConflicto({ tieneOtraInhabilidad: "no", descripcionInhabilidad: "" })}
            /> No
          </label>
        </div>
      </div>

      {conflicto.tieneOtraInhabilidad === "si" && (
        <div className={`field ${errors.descripcionInhabilidad ? "is-invalid" : ""}`}>
          <label>Describa la situación *</label>
          <textarea
            value={conflicto.descripcionInhabilidad}
            onChange={(e) => setConflicto({ descripcionInhabilidad: e.target.value })}
          />
          {errors.descripcionInhabilidad && <span className="field-error">{errors.descripcionInhabilidad}</span>}
        </div>
      )}
    </section>
  );
}
