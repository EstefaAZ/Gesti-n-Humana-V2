import { useEffect, useState } from "react";
import DocHeader from "../../components/DocHeader";
import { useAuth } from "../../context/AuthContext";
import * as authApi from "../../lib/api/authApi";
import * as perfilesApi from "../../lib/api/perfilesApi";
import { CATEGORIAS_DOCUMENTOS } from "../../lib/api/solicitudesApi";

function tablaSimple(arr, campos, labels) {
  if (!arr || arr.length === 0) return <p className="text-muted" style={{ fontSize: 12.5 }}>Sin registros.</p>;
  return (
    <table className="plain-table">
      <thead><tr>{labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
      <tbody>
        {arr.map((row, i) => (
          <tr key={i}>{campos.map((c) => <td key={c}>{row[c] ?? "—"}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

function DetalleCandidato({ candidato, perfil, onCerrar, token }) {
  const dp = perfil?.datosPersonales || {};
  return (
    <div className="card mt-24">
      <div className="wizard-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
        <h2 className="section-title" style={{ margin: 0 }}>{candidato.nombreCompleto}</h2>
        <button type="button" className="hr-link-btn" onClick={onCerrar}>Cerrar</button>
      </div>
      <p className="text-muted">Correo: {candidato.email} · Registrado: {candidato.fechaCreacion ? new Date(candidato.fechaCreacion).toLocaleDateString("es-CO") : "—"}</p>

      {!perfil ? (
        <div className="notice notice--warning">Este candidato todavía no ha completado su perfil.</div>
      ) : (
        <>
          <h3 className="section-title" style={{ fontSize: 14, marginTop: 16 }}>Datos personales</h3>
          <p style={{ fontSize: 13 }}>
            Cédula: {dp.cedula || "—"}<br />
            Residencia: {dp.direccion}, {dp.municipio}, {dp.deptoResidencia}<br />
            Celular: {dp.celular || "—"}
          </p>

          <h3 className="section-title" style={{ fontSize: 14 }}>Estudios, cursos, certificaciones e idiomas</h3>
          {tablaSimple(
            (perfil.registrosII || []).map((r) => ({
              tipo: r.tipoLabel,
              detalle: r.titulo || r.nombreEvento || r.nombreNorma || r.idioma || "—",
              establecimiento: r.establecimiento || r.enteCertificador || "—",
            })),
            ["tipo", "detalle", "establecimiento"],
            ["Tipo", "Detalle", "Establecimiento/Ente"]
          )}

          <h3 className="section-title" style={{ fontSize: 14 }}>Experiencia laboral</h3>
          {tablaSimple(perfil.experiencia, ["empresa", "cargo", "tiempoLaborado", "dedicacion"], ["Empresa", "Cargo", "Tiempo", "Dedicación"])}

          <h3 className="section-title" style={{ fontSize: 14 }}>Documentos del perfil</h3>
          {CATEGORIAS_DOCUMENTOS.map((cat) => {
            const archivos = perfil.documentosAdjuntos?.[cat.clave] || [];
            return (
              <div key={cat.clave} style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{cat.etiqueta}: </span>
                {archivos.length === 0 ? (
                  <span className="text-muted" style={{ fontSize: 12.5 }}>sin adjuntar</span>
                ) : (
                  archivos.map((doc, i) => (
                    <button
                      key={i}
                      type="button"
                      className="hr-link-btn"
                      style={{ marginRight: 10 }}
                      onClick={() => perfilesApi.descargarDocumentoDeCandidato(candidato.id, cat.claveApi, i, doc.nombre, token)}
                    >
                      📄 {doc.nombre}
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export default function CandidatosPage() {
  const { token } = useAuth();
  const [candidatos, setCandidatos] = useState(null);
  const [perfilesPorId, setPerfilesPorId] = useState({});
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState("todos"); // todos | completo | incompleto
  const [seleccionado, setSeleccionado] = useState(null);

  useEffect(() => {
    Promise.all([authApi.listarCandidatos(token), perfilesApi.listarTodos(token)])
      .then(([listaCandidatos, listaPerfiles]) => {
        setCandidatos(listaCandidatos);
        setPerfilesPorId(Object.fromEntries(listaPerfiles.map((p) => [p.usuarioId, p])));
      })
      .catch(() => setError("No se pudieron cargar los candidatos."));
  }, [token]);

  if (error) return <><DocHeader title="Candidatos" showCode={false} /><main className="page"><div className="notice notice--danger">{error}</div></main></>;
  if (!candidatos) return <><DocHeader title="Candidatos" showCode={false} /><main className="page"><p className="text-muted">Cargando…</p></main></>;

  const filtrados = candidatos.filter((c) => {
    const tienePerfil = !!perfilesPorId[c.id];
    if (filtroPerfil === "completo" && !tienePerfil) return false;
    if (filtroPerfil === "incompleto" && tienePerfil) return false;
    if (!busqueda.trim()) return true;
    const cedula = perfilesPorId[c.id]?.datosPersonales?.cedula || "";
    return `${c.nombreCompleto} ${cedula}`.toLowerCase().includes(busqueda.toLowerCase());
  });

  if (seleccionado) {
    return (
      <>
        <DocHeader title="Candidatos" showCode={false} />
        <main className="page">
          <DetalleCandidato candidato={seleccionado} perfil={perfilesPorId[seleccionado.id]} onCerrar={() => setSeleccionado(null)} token={token} />
        </main>
      </>
    );
  }

  return (
    <>
      <DocHeader title="Candidatos" showCode={false} />
      <main className="page">
        <div className="card">
          <div className="hr-table-actions" style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Buscar por nombre o cédula…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <select value={filtroPerfil} onChange={(e) => setFiltroPerfil(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="todos">Todos los candidatos</option>
              <option value="completo">Perfil completo</option>
              <option value="incompleto">Perfil incompleto</option>
            </select>
          </div>

          {filtrados.length === 0 ? (
            <div className="empty-state">Ningún candidato coincide con el filtro.</div>
          ) : (
            <table className="plain-table">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Perfil</th><th>Registrado</th><th></th></tr></thead>
              <tbody>
                {filtrados.map((c) => {
                  const tienePerfil = !!perfilesPorId[c.id];
                  return (
                    <tr key={c.id}>
                      <td>{c.nombreCompleto}</td>
                      <td>{c.email}</td>
                      <td>
                        <span className={`estado-badge ${tienePerfil ? "estado-badge--aceptada" : "estado-badge--rechazada"}`}>
                          {tienePerfil ? "Completo" : "Incompleto"}
                        </span>
                      </td>
                      <td>{c.fechaCreacion ? new Date(c.fechaCreacion).toLocaleDateString("es-CO") : "—"}</td>
                      <td><button type="button" className="hr-link-btn" onClick={() => setSeleccionado(c)}>Ver perfil</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
            Mostrando {filtrados.length} de {candidatos.length} candidatos
          </p>
        </div>
      </main>
    </>
  );
}
