import { calcularTiempoLaborado } from "../../lib/formState";

export default function ExperienciaCard({ experiencia, onChange, onRemove, index }) {
  const set = (patch) => {
    const merged = { ...experiencia, ...patch };
    merged.tiempoLaborado = calcularTiempoLaborado(merged.fechaInicio, merged.actual ? null : merged.fechaTerminacion);
    onChange(experiencia.id, { ...patch, tiempoLaborado: merged.tiempoLaborado });
  };

  return (
    <div className="repeatable-block">
      <div className="repeatable-block__header">
        <span className="repeatable-block__title">Experiencia laboral {index + 1}</span>
        <button type="button" className="repeatable-block__remove" onClick={() => onRemove(experiencia.id)}>
          Eliminar
        </button>
      </div>

      <div className="field-grid">
        <div className="field field--span2">
          <label>Nombre de la empresa</label>
          <input type="text" value={experiencia.empresa || ""} onChange={(e) => set({ empresa: e.target.value })} />
        </div>
        <div className="field">
          <label>Ciudad</label>
          <input type="text" value={experiencia.ciudad || ""} onChange={(e) => set({ ciudad: e.target.value })} />
        </div>
        <div className="field">
          <label>Departamento</label>
          <input type="text" value={experiencia.departamento || ""} onChange={(e) => set({ departamento: e.target.value })} />
        </div>
        <div className="field">
          <label>País</label>
          <input type="text" value={experiencia.pais || ""} onChange={(e) => set({ pais: e.target.value })} />
        </div>
        <div className="field">
          <label>Tipo de empresa</label>
          <select value={experiencia.tipoEmpresa || ""} onChange={(e) => set({ tipoEmpresa: e.target.value })}>
            <option value="">Seleccione…</option>
            <option>Pública</option>
            <option>Privada</option>
            <option>Mixta</option>
          </select>
        </div>
        <div className="field">
          <label>Proceso en el cual laboró</label>
          <input type="text" value={experiencia.proceso || ""} onChange={(e) => set({ proceso: e.target.value })} />
        </div>
        <div className="field">
          <label>Jefe inmediato</label>
          <input type="text" value={experiencia.jefeInmediato || ""} onChange={(e) => set({ jefeInmediato: e.target.value })} />
        </div>
        <div className="field">
          <label>Teléfono de la empresa</label>
          <input type="tel" value={experiencia.telEmpresa || ""} onChange={(e) => set({ telEmpresa: e.target.value })} />
        </div>
        <div className="field field--span2">
          <label>Cargo desempeñado</label>
          <input type="text" value={experiencia.cargo || ""} onChange={(e) => set({ cargo: e.target.value })} />
        </div>
        <div className="field">
          <label>Fecha inicio</label>
          <input type="date" value={experiencia.fechaInicio || ""} onChange={(e) => set({ fechaInicio: e.target.value })} />
        </div>
        <div className="field">
          <label>Fecha terminación</label>
          <input
            type="date"
            value={experiencia.fechaTerminacion || ""}
            disabled={experiencia.actual}
            onChange={(e) => set({ fechaTerminacion: e.target.value })}
          />
          <label className="radio-option" style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={!!experiencia.actual}
              onChange={(e) => set({ actual: e.target.checked, fechaTerminacion: e.target.checked ? "" : experiencia.fechaTerminacion })}
            />
            Trabajo actualmente aquí
          </label>
        </div>
        <div className="field">
          <label>Tiempo total laborado</label>
          <input type="text" value={experiencia.tiempoLaborado || "—"} disabled readOnly />
        </div>
        <div className="field">
          <label>Dedicación</label>
          <select value={experiencia.dedicacion || ""} onChange={(e) => set({ dedicacion: e.target.value })}>
            <option value="">Seleccione…</option>
            <option>Tiempo completo</option>
            <option>Medio tiempo</option>
            <option>Tiempo parcial</option>
          </select>
        </div>
        <div className="field field--span2">
          <label>Motivo de retiro</label>
          <input type="text" value={experiencia.motivoRetiro || ""} onChange={(e) => set({ motivoRetiro: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
