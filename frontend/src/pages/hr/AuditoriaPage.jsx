import { useEffect, useState } from "react";
import DocHeader from "../../components/DocHeader";
import { useAuth } from "../../context/AuthContext";
import * as authApi from "../../lib/api/authApi";
import * as vacantesApi from "../../lib/api/vacantesApi";
import * as solicitudesApi from "../../lib/api/solicitudesApi";

const ETIQUETA_MODULO = { login: "Login", vacantes: "Vacantes", candidatos: "Candidatos" };
const COLOR_MODULO = { login: "#2EA04A", vacantes: "#1B8A3A", candidatos: "#006228" };

function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  const f = new Date(fechaISO);
  return f.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AuditoriaPage() {
  const { token } = useAuth();
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    Promise.all([
      authApi.obtenerAuditoria(token, 100),
      vacantesApi.obtenerAuditoria(token, 100),
      solicitudesApi.obtenerAuditoria(token, 100),
    ])
      .then(([login, vacantes, candidatos]) => {
        const combinados = [
          ...login.map((e) => ({ ...e, modulo: "login" })),
          ...vacantes.map((e) => ({ ...e, modulo: "vacantes" })),
          ...candidatos.map((e) => ({ ...e, modulo: "candidatos" })),
        ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setEventos(combinados);
      })
      .catch(() => setError("No se pudo cargar la auditoría. Verifica que los 3 backends estén corriendo."));
  }, [token]);

  const filtrados = (eventos || []).filter((e) => {
    if (filtroModulo !== "todos" && e.modulo !== filtroModulo) return false;
    if (busqueda && !e.descripcion.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <DocHeader title="Auditoría" showCode={false} />
      <main className="page" style={{ maxWidth: 1000 }}>
        <p className="section-intro" style={{ marginTop: -8 }}>
          Registro de quién hizo qué y cuándo. Se muestran los últimos 100 eventos de cada uno.
        </p>

        {error && <div className="notice notice--danger">{error}</div>}

        <div className="card">
          <div className="hr-table-actions" style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Buscar en la descripción…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <select value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="todos">Todos los módulos</option>
              <option value="login">Login</option>
              <option value="vacantes">Vacantes</option>
              <option value="candidatos">Candidatos</option>
            </select>
          </div>

          {eventos === null ? (
            <p className="text-muted">Cargando…</p>
          ) : filtrados.length === 0 ? (
            <p className="text-muted">No hay eventos que coincidan.</p>
          ) : (
            <table className="plain-table">
              <thead>
                <tr><th>Fecha</th><th>Módulo</th><th>Evento</th><th>Actor</th></tr>
              </thead>
              <tbody>
                {filtrados.map((e) => (
                  <tr key={`${e.modulo}-${e.id}`}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>{formatearFecha(e.fecha)}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: COLOR_MODULO[e.modulo], textTransform: "uppercase" }}>
                        {ETIQUETA_MODULO[e.modulo]}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{e.descripcion}</td>
                    <td style={{ fontSize: 12.5 }} className="text-muted">{e.actorNombre || "—"}</td>
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
