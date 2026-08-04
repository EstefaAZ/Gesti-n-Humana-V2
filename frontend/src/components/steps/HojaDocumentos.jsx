import { useState } from "react";
import { archivoABase64 } from "../../lib/formState";

const CATEGORIAS = [
  { clave: "cedula", etiqueta: "Cédula de ciudadanía", max: 1, ayuda: "Copia legible de tu cédula." },
  { clave: "certificadosLaborales", etiqueta: "Certificados laborales con funciones", max: 10, ayuda: "Uno por cada empleo relevante, con funciones y fechas." },
  { clave: "certificadosEstudio", etiqueta: "Certificados de estudio y/o cursos", max: 10, ayuda: "Diplomas, actas de grado, certificados de cursos." },
  { clave: "tarjetaProfesional", etiqueta: "Tarjeta profesional", max: 3, ayuda: "Si tu profesión la requiere." },
];

const MAX_TAMANO_MB = 5;

export default function HojaDocumentos({ documentos, setDocumentos, errors }) {
  const [cargando, setCargando] = useState(null); // clave de la categoría que está procesando un archivo

  async function agregarArchivos(clave, max, fileList) {
    const actuales = documentos[clave] || [];
    const espacioDisponible = max - actuales.length;
    if (espacioDisponible <= 0) return;

    const archivos = Array.from(fileList).slice(0, espacioDisponible);
    const rechazadosPorTamano = archivos.filter((f) => f.size > MAX_TAMANO_MB * 1024 * 1024);
    if (rechazadosPorTamano.length > 0) {
      alert(`"${rechazadosPorTamano[0].name}" pesa más de ${MAX_TAMANO_MB} MB. Sube un archivo más liviano.`);
    }
    const validos = archivos.filter((f) => f.size <= MAX_TAMANO_MB * 1024 * 1024);
    if (validos.length === 0) return;

    setCargando(clave);
    try {
      const nuevos = await Promise.all(
        validos.map(async (f) => ({ nombre: f.name, contenidoBase64: await archivoABase64(f) }))
      );
      setDocumentos((prev) => ({ ...prev, [clave]: [...(prev[clave] || []), ...nuevos] }));
    } finally {
      setCargando(null);
    }
  }

  function quitarArchivo(clave, indice) {
    setDocumentos((prev) => ({ ...prev, [clave]: prev[clave].filter((_, i) => i !== indice) }));
  }

  return (
    <section>
      <h2 className="section-title">Documentos obligatorios</h2>
      <p className="section-intro">
        Adjunta los siguientes documentos para poder enviar tu solicitud. Formatos aceptados: PDF o imagen, máximo {MAX_TAMANO_MB} MB por archivo.
      </p>

      {CATEGORIAS.map((cat) => {
        const archivos = documentos[cat.clave] || [];
        const lleno = archivos.length >= cat.max;
        const tieneError = !!errors[cat.clave];

        return (
          <div key={cat.clave} className="field" style={{ marginBottom: 22 }}>
            <label>
              {cat.etiqueta} * <span className="text-muted" style={{ fontWeight: 400 }}>({archivos.length}/{cat.max})</span>
            </label>
            <p className="text-muted" style={{ fontSize: 12, margin: "0 0 8px" }}>{cat.ayuda}</p>

            {tieneError && <div className="notice notice--danger" style={{ marginBottom: 8 }}>{errors[cat.clave]}</div>}

            {archivos.length > 0 && (
              <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {archivos.map((doc, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: "var(--color-surface-sunken)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
                    📄 <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.nombre}</span>
                    <button type="button" className="hr-link-btn hr-link-btn--danger" onClick={() => quitarArchivo(cat.clave, i)}>Quitar</button>
                  </li>
                ))}
              </ul>
            )}

            {!lleno && (
              <input
                type="file"
                accept="application/pdf,image/*"
                multiple={cat.max > 1}
                disabled={cargando === cat.clave}
                onChange={(e) => {
                  agregarArchivos(cat.clave, cat.max, e.target.files);
                  e.target.value = ""; // permite volver a elegir el mismo archivo si lo quita y lo agrega de nuevo
                }}
              />
            )}
            {cargando === cat.clave && <p className="text-muted" style={{ fontSize: 12 }}>Cargando…</p>}
          </div>
        );
      })}
    </section>
  );
}
