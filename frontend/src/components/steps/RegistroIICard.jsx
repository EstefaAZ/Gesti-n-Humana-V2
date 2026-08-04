import { TIPO_REGISTRO_LABELS } from "../../data/catalogos";

const NIVELES_ESCALA = ["Regular", "Bien", "Muy bien"];

export default function RegistroIICard({ registro, onChange, onRemove, index }) {
  const set = (patch) => onChange(registro.id, patch);
  const setTipo = (tipo) => onChange(registro.id, { tipo, tipoLabel: TIPO_REGISTRO_LABELS[tipo] });

  return (
    <div className="repeatable-block">
      <div className="repeatable-block__header">
        <span className="repeatable-block__title">Registro {index + 1}</span>
        <button type="button" className="repeatable-block__remove" onClick={() => onRemove(registro.id)}>
          Eliminar
        </button>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Tipo de registro</label>
        <select value={registro.tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="estudio">Estudio formal</option>
          <option value="educacionTrabajo">Educación para el trabajo y el desarrollo humano</option>
          <option value="certificacion">Certificaciones y matrículas</option>
          <option value="idioma">Idioma</option>
        </select>
      </div>

      {registro.tipo === "estudio" && (
        <div className="field-grid">
          <div className="field">
            <label>Nivel educativo</label>
            <select value={registro.nivelEducativo || ""} onChange={(e) => set({ nivelEducativo: e.target.value })}>
              <option value="">Seleccione…</option>
              <option>Secundarios</option>
              <option>Técnico</option>
              <option>Tecnólogo</option>
              <option>Universitario</option>
              <option>Postgrado</option>
            </select>
          </div>
          <div className="field">
            <label>¿Graduado?</label>
            <div className="radio-row">
              <label className="radio-option">
                <input type="radio" name={`graduado-${registro.id}`} checked={registro.graduado === "si"} onChange={() => set({ graduado: "si" })} /> Sí
              </label>
              <label className="radio-option">
                <input type="radio" name={`graduado-${registro.id}`} checked={registro.graduado === "no"} onChange={() => set({ graduado: "no" })} /> No
              </label>
            </div>
          </div>
          <div className="field field--span2">
            <label>Título</label>
            <input type="text" value={registro.titulo || ""} onChange={(e) => set({ titulo: e.target.value })} />
          </div>
          <div className="field">
            <label>Establecimiento</label>
            <input type="text" value={registro.establecimiento || ""} onChange={(e) => set({ establecimiento: e.target.value })} />
          </div>
          <div className="field">
            <label>Ciudad</label>
            <input type="text" value={registro.ciudad || ""} onChange={(e) => set({ ciudad: e.target.value })} />
          </div>
          <div className="field">
            <label>Inicio (Año - Mes)</label>
            <input type="month" value={registro.inicio || ""} onChange={(e) => set({ inicio: e.target.value })} />
          </div>
          <div className="field">
            <label>Terminación (Año - Mes)</label>
            <input type="month" value={registro.terminacion || ""} onChange={(e) => set({ terminacion: e.target.value })} />
          </div>
        </div>
      )}

      {registro.tipo === "educacionTrabajo" && (
        <div className="field-grid">
          <div className="field field--span2">
            <label>Nombre del evento</label>
            <input type="text" value={registro.nombreEvento || ""} onChange={(e) => set({ nombreEvento: e.target.value })} />
          </div>
          <div className="field">
            <label>Fecha del certificado (Año - Mes)</label>
            <input type="month" value={registro.fechaCertificado || ""} onChange={(e) => set({ fechaCertificado: e.target.value })} />
          </div>
          <div className="field">
            <label>N° de horas</label>
            <input type="number" min="0" value={registro.numHoras || ""} onChange={(e) => set({ numHoras: e.target.value })} />
          </div>
          <div className="field field--span2">
            <label>Establecimiento</label>
            <input type="text" value={registro.establecimiento || ""} onChange={(e) => set({ establecimiento: e.target.value })} />
          </div>
        </div>
      )}

      {registro.tipo === "certificacion" && (
        <div className="field-grid">
          <div className="field field--span2">
            <label>Nombre de la norma o del certificado</label>
            <input type="text" value={registro.nombreNorma || ""} onChange={(e) => set({ nombreNorma: e.target.value })} />
          </div>
          <div className="field">
            <label>Número de documento o de la norma</label>
            <input type="text" value={registro.numDocumento || ""} onChange={(e) => set({ numDocumento: e.target.value })} />
          </div>
          <div className="field">
            <label>Fecha del certificado (Año - Mes)</label>
            <input type="month" value={registro.fechaCertificado || ""} onChange={(e) => set({ fechaCertificado: e.target.value })} />
          </div>
          <div className="field field--span2">
            <label>Ente certificador</label>
            <input type="text" value={registro.enteCertificador || ""} onChange={(e) => set({ enteCertificador: e.target.value })} />
          </div>
        </div>
      )}

      {registro.tipo === "idioma" && (
        <div className="field-grid field-grid--3">
          <div className="field">
            <label>Idioma</label>
            <input type="text" value={registro.idioma || ""} onChange={(e) => set({ idioma: e.target.value })} />
          </div>
          <div className="field">
            <label>Establecimiento</label>
            <input type="text" value={registro.establecimiento || ""} onChange={(e) => set({ establecimiento: e.target.value })} />
          </div>
          <div className="field">
            <label>Fecha (Año - Mes)</label>
            <input type="month" value={registro.fecha || ""} onChange={(e) => set({ fecha: e.target.value })} />
          </div>
          {["habla", "lee", "escribe"].map((campo) => (
            <div className="field" key={campo}>
              <label>Lo {campo}</label>
              <select value={registro[campo] || ""} onChange={(e) => set({ [campo]: e.target.value })}>
                <option value="">Seleccione…</option>
                {NIVELES_ESCALA.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
