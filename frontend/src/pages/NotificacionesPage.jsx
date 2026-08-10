import { useEffect, useState } from "react";
import DocHeader from "../components/DocHeader";
import { useAuth } from "../context/AuthContext";
import * as notificacionesApi from "../lib/api/notificacionesApi";

const ICONO_POR_TIPO = {
  cuenta_desactivada: "🔒",
  cuenta_reactivada: "🔓",
  solicitud_creada: "📩",
  estado_cambiado: "🔔",
  nueva_postulacion: "🧑‍💼",
};

function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  return new Date(fechaISO).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NotificacionesPage() {
  const { token } = useAuth();
  const [notificaciones, setNotificaciones] = useState(null);
  const [error, setError] = useState("");

  async function cargar() {
    try {
      setNotificaciones(await notificacionesApi.listarTodas(token));
    } catch {
      setError("No se pudieron cargar tus notificaciones.");
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function marcarLeida(n) {
    if (n.leida) return;
    try {
      await notificacionesApi.marcarLeida(n, token);
      setNotificaciones((prev) => prev.map((x) => (x.id === n.id && x.servicio === n.servicio ? { ...x, leida: true } : x)));
    } catch {
      // no bloquea la interfaz
    }
  }

  async function marcarTodas() {
    try {
      await notificacionesApi.marcarTodasLeidas(token);
      setNotificaciones((prev) => prev.map((x) => ({ ...x, leida: true })));
    } catch {
      // no bloquea la interfaz
    }
  }

  const hayNoLeidas = (notificaciones || []).some((n) => !n.leida);

  return (
    <>
      <DocHeader title="Notificaciones" showCode={false} />
      <main className="page">
        {error && <div className="notice notice--danger">{error}</div>}

        <div className="card">
          <div className="hr-table-actions" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Todas tus notificaciones</h2>
            {hayNoLeidas && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={marcarTodas}>Marcar todas leídas</button>
            )}
          </div>

          {notificaciones === null ? (
            <p className="text-muted">Cargando…</p>
          ) : notificaciones.length === 0 ? (
            <div className="empty-state">Todavía no tienes notificaciones.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {notificaciones.map((n) => (
                <li
                  key={`${n.servicio}-${n.id}`}
                  onClick={() => marcarLeida(n)}
                  style={{
                    display: "flex", gap: 14, padding: "14px 4px", borderBottom: "1px solid var(--color-border)",
                    cursor: n.leida ? "default" : "pointer",
                    background: n.leida ? "transparent" : "var(--color-primary-tint)",
                    borderRadius: n.leida ? 0 : "var(--radius)",
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{ICONO_POR_TIPO[n.tipo] || "🔔"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{n.titulo}</div>
                    <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>{n.mensaje}</div>
                    <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 6 }}>{formatearFecha(n.fechaCreacion)}</div>
                  </div>
                  {!n.leida && <span className="estado-badge estado-badge--preseleccionado" style={{ height: "fit-content" }}>Nueva</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
