import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import DocHeader from "../../components/DocHeader";
import { useAuth } from "../../context/AuthContext";
import * as authApi from "../../lib/api/authApi";
import * as vacantesApi from "../../lib/api/vacantesApi";
import * as solicitudesApi from "../../lib/api/solicitudesApi";

const ETIQUETA_ROL = { candidato: "Candidato", gestor_humano: "Gestión Humana", admin: "Administrador" };

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function formatearMes(mesISO) {
  const [, mes] = mesISO.split("-");
  return NOMBRES_MES[parseInt(mes, 10) - 1] || mesISO;
}

function tiempoRelativo(fechaISO) {
  if (!fechaISO) return "";
  const diffMs = Date.now() - new Date(fechaISO).getTime();
  const horas = Math.floor(diffMs / 3600000);
  if (horas < 1) return "Hace unos minutos";
  if (horas < 24) return `Hace ${horas} hora${horas === 1 ? "" : "s"}`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} día${dias === 1 ? "" : "s"}`;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [loginStats, setLoginStats] = useState(null);
  const [vacantesStats, setVacantesStats] = useState(null);
  const [candidatosStats, setCandidatosStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      authApi.obtenerEstadisticas(token),
      vacantesApi.obtenerEstadisticas(token),
      solicitudesApi.obtenerEstadisticas(token),
    ])
      .then(([l, v, c]) => {
        setLoginStats(l);
        setVacantesStats(v);
        setCandidatosStats(c);
      })
      .catch(() => setError("No se pudieron cargar las estadísticas. Verifica que los 3 backends estén corriendo."));
  }, [token]);

  if (error) {
    return (
      <>
        <DocHeader title="Dashboard" showCode={false} />
        <main className="page"><div className="card"><div className="notice notice--danger">{error}</div></div></main>
      </>
    );
  }

  if (!loginStats || !vacantesStats || !candidatosStats) {
    return (
      <>
        <DocHeader title="Dashboard" showCode={false} />
        <main className="page"><div className="card"><p className="text-muted">Cargando estadísticas…</p></div></main>
      </>
    );
  }

  const ETIQUETA_ESTADO_VACANTE = {
    publicada: "Publicada",
    enProceso: "En proceso",
    cerrada: "Cerrada",
    borrador: "Borrador",
    canceladaDesierta: "Cancelada/Desierta",
  };
  const COLOR_ESTADO_VACANTE = {
    publicada: "#2EA04A",
    enProceso: "#E8B93A",
    cerrada: "#C0574F",
    borrador: "#B7C4C2",
    canceladaDesierta: "#4E8FD1",
  };
  const datosDonut = Object.entries(vacantesStats.porEstado || {})
    .map(([estado, valor]) => ({ name: ETIQUETA_ESTADO_VACANTE[estado] || estado, estado, value: valor }))
    .filter((d) => d.value > 0);

  const datosBarras = candidatosStats.porMes.map((p) => ({ mes: formatearMes(p.mes), total: p.total }));

  const actividad = [
    ...vacantesStats.recientes.map((v) => ({
      fecha: v.fechaCreacion,
      texto: `Nueva vacante publicada: ${v.cargo}`,
    })),
    ...candidatosStats.recientes.map((s) => ({
      fecha: s.fechaSolicitud,
      texto: `Nueva postulación de ${s.nombreCompleto || "un candidato"}`,
    })),
    ...loginStats.recientes.map((u) => ({
      fecha: u.fechaCreacion,
      texto: `Nuevo usuario registrado: ${u.nombreCompleto} (${ETIQUETA_ROL[u.rol] || u.rol})`,
    })),
  ]
    .filter((a) => a.fecha)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 8);

  return (
    <>
      <DocHeader title="Dashboard" showCode={false} />
      <main className="page" style={{ maxWidth: 1100 }}>
        <p className="section-intro" style={{ marginTop: -8 }}>Resumen general del sistema de selección de talento.</p>

        <div className="stat-cards-grid">
          <div className="stat-card">
            <div className="stat-card__value">{loginStats.total}</div>
            <div className="stat-card__label">Usuarios registrados</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{vacantesStats.activas}</div>
            <div className="stat-card__label">Vacantes activas</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{candidatosStats.total}</div>
            <div className="stat-card__label">Postulaciones</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__value">{vacantesStats.abiertas}</div>
            <div className="stat-card__label">Vacantes abiertas</div>
          </div>
        </div>

        <div className="dashboard-charts-grid">
          <div className="card">
            <h3 className="section-title" style={{ fontSize: 15 }}>Postulaciones por mes</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={datosBarras}>
                <XAxis dataKey="mes" fontSize={12} stroke="#5B6B60" />
                <YAxis allowDecimals={false} fontSize={12} stroke="#5B6B60" />
                <Tooltip />
                <Bar dataKey="total" fill="#2EA04A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="section-title" style={{ fontSize: 15 }}>Vacantes por estado</h3>
            {datosDonut.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13, textAlign: "center", padding: "80px 0" }}>Todavía no hay vacantes creadas.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={datosDonut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                    {datosDonut.map((d) => <Cell key={d.estado} fill={COLOR_ESTADO_VACANTE[d.estado] || "#B7C4C2"} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <h3 className="section-title" style={{ fontSize: 15 }}>Actividad reciente</h3>
            {actividad.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>Todavía no hay actividad registrada.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {actividad.map((a, i) => (
                  <li key={i} style={{ fontSize: 13 }}>
                    <div style={{ color: "var(--color-text)" }}>{a.texto}</div>
                    <div className="text-muted" style={{ fontSize: 11.5 }}>{tiempoRelativo(a.fecha)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="dashboard-actions-grid">
          <Link to="/gestion-humana" className="card dashboard-action">+ Crear vacante</Link>
          <Link to="/gestion-humana" className="card dashboard-action">Ver postulaciones</Link>
          <Link to="/usuarios" className="card dashboard-action">Gestionar usuarios</Link>
        </div>
      </main>
    </>
  );
}
