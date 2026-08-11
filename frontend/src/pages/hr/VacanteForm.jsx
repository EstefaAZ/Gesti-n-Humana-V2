import { useState } from "react";
import { NIVELES_EDUCATIVOS, NIVELES_IDIOMA, TIPOS_VINCULACION, PUBLICO_OBJETIVO_OPCIONES } from "../../data/catalogos";
import { formatearMilesCOP } from "../../lib/formato";

const ESTADOS = [
  { valor: "borrador", etiqueta: "Borrador" },
  { valor: "publicada", etiqueta: "Publicada" },
  { valor: "en_proceso", etiqueta: "En proceso" },
  { valor: "cerrada", etiqueta: "Cerrada" },
  { valor: "cancelada_desierta", etiqueta: "Cancelada / Desierta" },
];

const MAX_CERTIFICACIONES = 5;

export default function VacanteForm({ vacanteInicial, onGuardar, onCancelar }) {
  const [v, setV] = useState(vacanteInicial);
  const [pdfFile, setPdfFile] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const set = (patch) => setV((prev) => ({ ...prev, ...patch }));
  const setCriterio = (patch) => setV((prev) => ({ ...prev, criterios: { ...prev.criterios, ...patch } }));

  const certificaciones = v.criterios.certificacionesKeywords || [];

  function agregarCertificacion() {
    if (certificaciones.length >= MAX_CERTIFICACIONES) return;
    setCriterio({ certificacionesKeywords: [...certificaciones, ""] });
  }
  function cambiarCertificacion(i, valor) {
    const copia = [...certificaciones];
    copia[i] = valor;
    setCriterio({ certificacionesKeywords: copia });
  }
  function quitarCertificacion(i) {
    setCriterio({ certificacionesKeywords: certificaciones.filter((_, idx) => idx !== i) });
  }

  async function handleGuardar() {
    if (!v.cargo.trim() || !v.procesoNo.trim()) {
      alert("Completa al menos el cargo y el número de proceso.");
      return;
    }
    const limpio = {
      ...v,
      plazas: v.plazas === "" ? 1 : Number(v.plazas),
      fechaApertura: v.fechaApertura || null,
      fechaCierre: v.fechaCierre || null,
      criterios: {
        ...v.criterios,
        experienciaMinAnios: v.criterios.experienciaMinAnios === "" ? null : Number(v.criterios.experienciaMinAnios),
        certificacionesKeywords: certificaciones.map((c) => c.trim()).filter(Boolean),
      },
    };
    setGuardando(true);
    try {
      await onGuardar(limpio, pdfFile);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">{vacanteInicial.id && vacanteInicial._editando ? "Editar vacante" : "Nueva vacante"}</h2>

      <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 20 }}>
        <legend style={{ fontWeight: 700, color: "var(--color-primary-dark)", padding: "0 6px" }}>
          Información de la convocatoria (GTH-FOR-02)
        </legend>
        <div className="field-grid">
          <div className="field"><label>Proceso de selección No. *</label><input type="text" value={v.procesoNo} onChange={(e) => set({ procesoNo: e.target.value })} /></div>
          <div className="field field--span2"><label>Cargo *</label><input type="text" value={v.cargo} onChange={(e) => set({ cargo: e.target.value })} /></div>
          <div className="field field--span2">
            <label>Descripción breve (la verá el candidato en el listado y el detalle de la vacante)</label>
            <textarea value={v.descripcion} onChange={(e) => set({ descripcion: e.target.value })} placeholder="Ej: Buscamos un perfil analítico con experiencia en tratamiento de aguas residuales…" />
          </div>
          <div className="field"><label>Proceso / Área</label><input type="text" value={v.area} onChange={(e) => set({ area: e.target.value })} /></div>
          <div className="field">
            <label>Salario básico</label>
            <input
              type="text"
              inputMode="numeric"
              value={v.salario}
              onChange={(e) => set({ salario: formatearMilesCOP(e.target.value) })}
              placeholder="Ej: 3.377.598"
            />
          </div>
          <div className="field">
            <label>Tipo de vinculación</label>
            <select value={v.tipoVinculacion} onChange={(e) => set({ tipoVinculacion: e.target.value })}>
              <option value="">Seleccione…</option>
              {TIPOS_VINCULACION.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field"><label>Sede</label><input type="text" value={v.sede} onChange={(e) => set({ sede: e.target.value })} /></div>
          <div className="field"><label>N° de plazas</label><input type="number" min="1" value={v.plazas} onChange={(e) => set({ plazas: e.target.value })} /></div>
          <div className="field">
            <label>Público objetivo</label>
            <select value={v.publicoObjetivo} onChange={(e) => set({ publicoObjetivo: e.target.value })}>
              {PUBLICO_OBJETIVO_OPCIONES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field field--span2">
            <label>Estado</label>
            <select value={v.estado} onChange={(e) => set({ estado: e.target.value })}>
              {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
            </select>
            <span className="hint">Solo "Publicada" y "Cerrada" son visibles para los candidatos.</span>
          </div>
          <div className="field"><label>Fecha de apertura</label><input type="date" value={v.fechaApertura} onChange={(e) => set({ fechaApertura: e.target.value })} /></div>
          <div className="field"><label>Fecha de cierre</label><input type="date" value={v.fechaCierre} onChange={(e) => set({ fechaCierre: e.target.value })} /></div>
          <div className="field"><label>Hora de cierre</label><input type="time" value={v.horaCierre} onChange={(e) => set({ horaCierre: e.target.value })} /></div>
        </div>
        <div className="field mt-24">
          <label>Requisitos obligatorios (texto libre, opcional)</label>
          <textarea value={v.requisitosObligatorios} onChange={(e) => set({ requisitosObligatorios: e.target.value })} />
        </div>
        <div className="field">
          <label>Conocimientos complementarios</label>
          <textarea value={v.conocimientosComplementarios} onChange={(e) => set({ conocimientosComplementarios: e.target.value })} />
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 20 }}>
        <legend style={{ fontWeight: 700, color: "var(--color-primary-dark)", padding: "0 6px" }}>
          Criterios de evaluación automática
        </legend>
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: -4 }}>
          Estos criterios solo priorizan y advierten a Gestión Humana; nunca bloquean el envío de la solicitud del aspirante.
        </p>
        <div className="field-grid">
          <div className="field">
            <label>Nivel educativo mínimo</label>
            <select value={v.criterios.nivelEducativoMin} onChange={(e) => setCriterio({ nivelEducativoMin: e.target.value })}>
              <option value="">Sin requisito</option>
              {NIVELES_EDUCATIVOS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field">
            <label>¿Requiere graduado?</label>
            <select value={v.criterios.graduadoRequerido ? "Sí" : "No"} onChange={(e) => setCriterio({ graduadoRequerido: e.target.value === "Sí" })}>
              <option>Sí</option>
              <option>No</option>
            </select>
          </div>
          <div className="field"><label>Palabra clave de profesión/título</label><input type="text" value={v.criterios.profesionKeyword} onChange={(e) => setCriterio({ profesionKeyword: e.target.value })} /></div>
        </div>
        <div className="field-grid">
          <div className="field"><label>Años mínimos de experiencia</label><input type="number" min="0" step="0.5" value={v.criterios.experienciaMinAnios} onChange={(e) => setCriterio({ experienciaMinAnios: e.target.value })} /></div>
        </div>
        <div className="field-grid field-grid--3">
          <div className="field"><label>Idioma requerido (opcional)</label><input type="text" value={v.criterios.idiomaRequerido} onChange={(e) => setCriterio({ idiomaRequerido: e.target.value })} /></div>
          <div className="field">
            <label>Habilidad evaluada</label>
            <select value={v.criterios.idiomaHabilidad} onChange={(e) => setCriterio({ idiomaHabilidad: e.target.value })}>
              <option value="habla">Lo habla</option>
              <option value="lee">Lo lee</option>
              <option value="escribe">Lo escribe</option>
            </select>
          </div>
          <div className="field">
            <label>Nivel mínimo</label>
            <select value={v.criterios.idiomaNivelMin} onChange={(e) => setCriterio({ idiomaNivelMin: e.target.value })}>
              {NIVELES_IDIOMA.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Certificaciones requeridas (palabra clave) hasta {MAX_CERTIFICACIONES}, opcional</label>
          {certificaciones.length === 0 && (
            <p className="text-muted" style={{ fontSize: 12.5, margin: "4px 0" }}>Ninguna certificación requerida todavía.</p>
          )}
          {certificaciones.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="text" value={c} onChange={(e) => cambiarCertificacion(i, e.target.value)} placeholder="Ej: Trabajo en alturas" style={{ flex: 1 }} />
              <button type="button" className="hr-link-btn hr-link-btn--danger" onClick={() => quitarCertificacion(i)}>Quitar</button>
            </div>
          ))}
          {certificaciones.length < MAX_CERTIFICACIONES && (
            <button type="button" className="btn btn-secondary" onClick={agregarCertificacion}>+ Agregar certificación</button>
          )}
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 20 }}>
        <legend style={{ fontWeight: 700, color: "var(--color-primary-dark)", padding: "0 6px" }}>
          Formato oficial de la convocatoria (PDF)
        </legend>
        <p className="text-muted" style={{ fontSize: 12.5, marginTop: -4 }}>
          Opcional. Si lo subes, el candidato podra verlo.
        </p>
        {v.tieneDocumentoPdf && !pdfFile && (
          <p style={{ fontSize: 13 }}>📄 Ya hay un PDF para esta vacante. Elige otro archivo abajo si quieres reemplazarlo.</p>
        )}
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
        />
        {pdfFile && <p style={{ fontSize: 12.5 }}>Se subirá: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
      </fieldset>

      <div className="btn-row" style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-primary" onClick={handleGuardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar vacante"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancelar} disabled={guardando}>Cancelar</button>
      </div>
    </div>
  );
}
