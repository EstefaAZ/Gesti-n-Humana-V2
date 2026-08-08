import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import { useAuth } from "../context/AuthContext";
import * as perfilesApi from "../lib/api/perfilesApi";
import * as solicitudesApi from "../lib/api/solicitudesApi";
import * as vacantesApi from "../lib/api/vacantesApi";
import { CATEGORIAS_DOCUMENTOS } from "../lib/api/solicitudesApi";

export default function DocumentosPage() {
  const { token } = useAuth();
  const [perfil, setPerfil] = useState(undefined); // undefined = cargando, null = sin perfil
  const [postulaciones, setPostulaciones] = useState([]);
  const [vacantesPorId, setVacantesPorId] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    perfilesApi.obtenerMiPerfil(token).then(setPerfil).catch(() => setPerfil(null));

    solicitudesApi
      .misSolicitudes(token)
      .then(async (lista) => {
        setPostulaciones(lista);
        const entradas = await Promise.all(
          lista.map(async (p) => {
            try {
              return [p.vacanteId, await vacantesApi.obtenerPublica(p.vacanteId)];
            } catch {
              return [p.vacanteId, null];
            }
          })
        );
        setVacantesPorId(Object.fromEntries(entradas));
      })
      .catch(() => setError("No se pudieron cargar tus postulaciones."));
  }, [token]);

  if (perfil === undefined) {
    return <><DocHeader title="Documentos" showCode={false} /><main className="page"><p className="text-muted">Cargando…</p></main></>;
  }

  return (
    <>
      <DocHeader title="Documentos" showCode={false} />
      <main className="page">
        {error && <div className="notice notice--danger">{error}</div>}

        <div className="card">
          <h2 className="section-title" style={{ fontSize: 16 }}>Documentos de tu perfil</h2>
          {!perfil ? (
            <p className="text-muted">
              Todavía no has completado tu perfil. <Link to="/completar-perfil">Completarlo ahora →</Link>
            </p>
          ) : (
            CATEGORIAS_DOCUMENTOS.map((cat) => {
              const archivos = perfil.documentosAdjuntos?.[cat.clave] || [];
              return (
                <div key={cat.clave} style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.etiqueta}: </span>
                  {archivos.length === 0 ? (
                    <span className="text-muted" style={{ fontSize: 13 }}>sin adjuntar</span>
                  ) : (
                    archivos.map((doc, i) => (
                      <button
                        key={i}
                        type="button"
                        className="hr-link-btn"
                        style={{ marginRight: 10 }}
                        onClick={() => perfilesApi.descargarMiDocumento(cat.claveApi, i, doc.nombre, token)}
                      >
                        📄 {doc.nombre}
                      </button>
                    ))
                  )}
                </div>
              );
            })
          )}
          {perfil && (
            <p className="text-muted mt-24" style={{ fontSize: 12 }}>
              ¿Necesitas actualizar alguno? <Link to="/completar-perfil">Edita tu perfil</Link>.
            </p>
          )}
        </div>

        {postulaciones.length > 0 && (
          <div className="card mt-24">
            <h2 className="section-title" style={{ fontSize: 16 }}>Documentos por postulación</h2>
            <p className="text-muted" style={{ fontSize: 12.5, marginTop: -4 }}>
              Incluye los de tu perfil más cualquier certificación extra que hayas adjuntado para esa vacante en particular.
            </p>
            {postulaciones.map((p) => (
              <div key={p.radicado} style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14, marginTop: 14 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 8px" }}>
                  {vacantesPorId[p.vacanteId]?.cargo || p.vacanteId} <span className="text-muted" style={{ fontWeight: 400 }}>({p.radicado})</span>
                </p>
                {CATEGORIAS_DOCUMENTOS.map((cat) => {
                  const archivos = p.documentosAdjuntos?.[cat.clave] || [];
                  if (archivos.length === 0) return null;
                  return (
                    <div key={cat.clave} style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{cat.etiqueta}: </span>
                      {archivos.map((doc, i) => (
                        <button
                          key={i}
                          type="button"
                          className="hr-link-btn"
                          style={{ marginRight: 10, fontSize: 12.5 }}
                          onClick={() => solicitudesApi.descargarDocumentoAdjunto(p.radicado, cat.claveApi, i, doc.nombre, token)}
                        >
                          📄 {doc.nombre}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
