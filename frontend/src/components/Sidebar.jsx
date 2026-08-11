import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo-aguas-nacionales.png";

// ---- Íconos (SVG simples, sin dependencias externas) ----
const Icon = ({ d, ...props }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {d}
  </svg>
);
const IconHome = () => <Icon d={<path d="M3 11l9-8 9 8M5 10v10h14V10" />} />;
const IconBriefcase = () => <Icon d={<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>} />;
const IconUsers = () => <Icon d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>} />;
const IconChart = () => <Icon d={<><path d="M3 3v18h18" /><path d="M7 13l3-3 3 3 5-6" /></>} />;
const IconShield = () => <Icon d={<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />} />;
const IconSettings = () => <Icon d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.66.24 1.24.68 1.51 1.51H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>} />;
const IconEye = () => <Icon d={<><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></>} />;
const IconFolder = () => <Icon d={<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />} />;
const IconBell = () => <Icon d={<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>} />;
const IconChat = () => <Icon d={<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />} />;
const IconCalendar = () => <Icon d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />;
const IconUser = () => <Icon d={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />;
const IconLogout = () => <Icon d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>} />;
const IconChevron = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

function itemsPara(rol) {
  if (rol === "candidato") {
    return [
      { to: "/", label: "Vacantes", icon: IconBriefcase },
      { to: "/mis-postulaciones", label: "Mis postulaciones", icon: IconFolder },
      { to: "/perfil", label: "Mi perfil", icon: IconUser },
      { to: "/documentos", label: "Documentos", icon: IconFolder },
      { to: "/notificaciones", label: "Notificaciones", icon: IconBell },
      { label: "Configuración", icon: IconSettings, proximamente: true },
    ];
  }

  // gestor_humano y admin comparten la base operativa
  const base = [
    { to: "/gestion-humana", label: "Procesos de Selección", icon: IconUsers },
    { to: "/reportes", label: "Reportes", icon: IconChart },
  ];

  if (rol === "admin") {
    base.unshift({ to: "/dashboard", label: "Dashboard", icon: IconHome });
    base.push(
      { to: "/usuarios", label: "Usuarios", icon: IconUsers },
      { to: "/auditoria", label: "Auditoría", icon: IconEye },
      { label: "Roles y permisos", icon: IconShield, proximamente: true },
      { label: "Configuración", icon: IconSettings, proximamente: true },
    );
  }

  base.push(
    { to: "/notificaciones", label: "Notificaciones", icon: IconBell },
    { to: "/perfil", label: "Mi perfil", icon: IconUser },
  );
  return base;
}

const ETIQUETAS_ROL = { candidato: "Candidato", gestor_humano: "Gestión Humana", admin: "Administrador" };

export default function Sidebar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [colapsado, setColapsado] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const items = itemsPara(usuario?.rol);

  return (
    <aside className={`sidebar ${colapsado ? "sidebar--colapsado" : ""}`}>
      <div className="sidebar__brand">
        {!colapsado && <img src={logo} alt="Aguas Nacionales EPM" className="sidebar__logo" />}
        <button
          type="button"
          className="sidebar__toggle"
          onClick={() => setColapsado((v) => !v)}
          aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}
        >
          <IconChevron open={!colapsado} />
        </button>
      </div>

      <nav className="sidebar__nav">
        {items.map((item, i) =>
          item.proximamente ? (
            <span key={i} className="sidebar__item sidebar__item--disabled" title="Próximamente">
              <item.icon />
              {!colapsado && <span className="sidebar__item-label">{item.label}</span>}
              {!colapsado && <span className="sidebar__soon">Pronto</span>}
            </span>
          ) : (
            <Link
              key={i}
              to={item.to}
              className={`sidebar__item ${location.pathname === item.to ? "is-active" : ""}`}
              title={item.label}
            >
              <item.icon />
              {!colapsado && <span className="sidebar__item-label">{item.label}</span>}
            </Link>
          )
        )}
      </nav>

      <div className="sidebar__footer">
        {!colapsado && (
          <div className="sidebar__user">
            <div className="sidebar__user-name">{usuario?.nombreCompleto}</div>
            <div className="sidebar__user-rol">{ETIQUETAS_ROL[usuario?.rol] || usuario?.rol}</div>
          </div>
        )}
        <button type="button" className="sidebar__item sidebar__logout" onClick={handleLogout} title="Cerrar sesión">
          <IconLogout />
          {!colapsado && <span className="sidebar__item-label">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}