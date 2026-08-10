import { useEffect, useState } from "react";
import DocHeader from "../../components/DocHeader";
import { useAuth } from "../../context/AuthContext";
import * as vacantesApi from "../../lib/api/vacantesApi";
import * as solicitudesApi from "../../lib/api/solicitudesApi";

export default function ReportesPage() {
  const { token } = useAuth();
  const [vacantes, setVacantes] = useState(null);
  const [conteo, setConteo] = useState({});
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [descargandoId, setDescargandoId] = useState(null);

  useEffect(() => {
    Promise.all([vacantesApi.listarAdmin(token), solicitudesApi.conteoPorVacante(token)])
      .then(([listaVacantes, conteoPost]) => {
        setVacantes(listaVacantes);
        setConteo(conteoPost);
      })
      .catch(() => setError("No se pudieron cargar las vacantes."));
  }, [token]);

  async function descargar(v) {
    setDescargandoId(v.id);
    try {
      await solicitudesApi.descargarReporte(v.id, `GTH-FOR-03_${v.procesoNo}.xlsx`, token);
    } catch {
      alert("No se pudo descargar el reporte. Intenta de nuevo.");
    } finally {
      setDescargandoId(null);
    }
  }

  if (error) return <><DocHeader title="Reportes" showCode={false} /><main className="page"><div className="notice notice--danger">{error}</div></main></>;
  if (!vacantes) return <><DocHeader title="Reportes" showCode={false} /><main className="page"><p className="text-muted">Cargando…</p></main></>;

  const filtradas = vacantes.filter(
    (v) => !busqueda.trim() || `${v.cargo} ${v.procesoNo}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <>
      <DocHeader title="Reportes" showCode={false} />
      <main className="page">
        <div className="card">
          

          <div className="field" style={{ maxWidth: 320, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Buscar vacante…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {filtradas.length === 0 ? (
            <div className="empty-state">
              {vacantes.length === 0 ? "Aún no hay vacantes creadas." : "Ninguna vacante coincide con la búsqueda."}
            </div>
          ) : (
            <table className="plain-table">
              <thead><tr><th>Vacante</th><th>Estado</th><th>Postulaciones</th><th></th></tr></thead>
              <tbody>
                {filtradas.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>{v.procesoNo}</span>
                      <br />{v.cargo}
                    </td>
                    <td>{v.estado}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{conteo[v.id] || 0}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={descargandoId === v.id || !(conteo[v.id] > 0)}
                        onClick={() => descargar(v)}
                        title={!(conteo[v.id] > 0) ? "Todavía no hay postulaciones para esta vacante" : ""}
                      >
                        {descargandoId === v.id ? "Descargando…" : "📊 Descargar reporte"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
