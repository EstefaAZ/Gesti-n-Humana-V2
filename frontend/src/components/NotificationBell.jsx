import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as notificacionesApi from "../lib/api/notificacionesApi";

const ICONO_POR_TIPO = {
  cuenta_desactivada: "🔒",
  cuenta_reactivada: "🔓",
  solicitud_creada: "📩",
  estado_cambiado: "🔔",
  nueva_postulacion: "🧑‍💼",
};

function tiempoRelativo(fechaISO) {
  if (!fechaISO) return "";
  const diffMs = Date.now() - new Date(fechaISO).getTime();
  const horas = Math.floor(diffMs / 3600000);
  if (horas < 1) return "Hace unos minutos";
  if (horas < 24) return `Hace ${horas} hora${horas === 1 ? "" : "s"}`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} día${dias === 1 ? "" : "s"}`;
}

export default function NotificationBell() {
  const { token, autenticado } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [conteo, setConteo] = useState(0);
  const [notificaciones, setNotificaciones] = useState(null);
  const ref = useRef(null);

  async function cargarConteo() {
    try {
      setConteo(await notificacionesApi.obtenerConteo(token));
    } catch {
      // silencioso — la campanita no debe romper el resto del sitio si falla
    }
  }

  useEffect(() => {
    if (!autenticado) return;
    cargarConteo();
    const intervalo = setInterval(cargarConteo, 30000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado, token]);

  useEffect(() => {
    if (!abierto) return;
    function onClickAfuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickAfuera);
    return () => document.removeEventListener("mousedown", onClickAfuera);
  }, [abierto]);

  async function abrirPanel() {
    const yaAbierto = abierto;
    setAbierto(!yaAbierto);
    if (!yaAbierto) {
      try {
        setNotificaciones(await notificacionesApi.listarTodas(token));
      } catch {
        setNotificaciones([]);
      }
    }
  }

  async function marcarLeida(n) {
    if (n.leida) return;
    try {
      await notificacionesApi.marcarLeida(n, token);
      setNotificaciones((prev) => prev.map((x) => (x.id === n.id && x.servicio === n.servicio ? { ...x, leida: true } : x)));
      setConteo((c) => Math.max(0, c - 1));
    } catch {
      // sin bloquear la UI si falla
    }
  }

  async function marcarTodas() {
    try {
      await notificacionesApi.marcarTodasLeidas(token);
      setNotificaciones((prev) => prev.map((x) => ({ ...x, leida: true })));
      setConteo(0);
    } catch {
      // sin bloquear la UI si falla
    }
  }

  if (!autenticado) return null;

  const recientes = (notificaciones || []).slice(0, 8);

  return (
    <div className="notif-bell" ref={ref}>
      <button type="button" className="notif-bell__boton" onClick={abrirPanel} aria-label="Notificaciones">
        🔔
        {conteo > 0 && <span className="notif-bell__badge">{conteo > 9 ? "9+" : conteo}</span>}
      </button>

      {abierto && (
        <div className="notif-bell__panel">
          <div className="notif-bell__header">
            <span>Notificaciones</span>
            {conteo > 0 && (
              <button type="button" className="hr-link-btn" onClick={marcarTodas}>Marcar todas leídas</button>
            )}
          </div>

          {notificaciones === null ? (
            <p className="text-muted" style={{ fontSize: 12.5, padding: "12px 16px" }}>Cargando…</p>
          ) : recientes.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 12.5, padding: "12px 16px" }}>No tienes notificaciones todavía.</p>
          ) : (
            <ul className="notif-bell__lista">
              {recientes.map((n) => (
                <li
                  key={`${n.servicio}-${n.id}`}
                  className={`notif-bell__item ${n.leida ? "" : "is-unread"}`}
                  onClick={() => marcarLeida(n)}
                >
                  <span className="notif-bell__icono">{ICONO_POR_TIPO[n.tipo] || "🔔"}</span>
                  <div>
                    <div className="notif-bell__titulo">{n.titulo}</div>
                    <div className="notif-bell__mensaje">{n.mensaje}</div>
                    <div className="notif-bell__fecha">{tiempoRelativo(n.fechaCreacion)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="notif-bell__vertodas"
            onClick={() => {
              setAbierto(false);
              navigate("/notificaciones");
            }}
          >
            Ver todas
          </button>
        </div>
      )}
    </div>
  );
}
