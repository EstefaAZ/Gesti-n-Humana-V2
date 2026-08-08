import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * @param {"cualquiera"|"gestion"|"admin"} nivel - "cualquiera": solo requiere estar logueado.
 *   "gestion": requiere rol gestor_humano o admin. "admin": requiere específicamente admin.
 */
export default function ProtectedRoute({ nivel = "cualquiera", children }) {
  const { autenticado, esGestion, usuario, cargando, perfilCompletado } = useAuth();
  const location = useLocation();

  if (cargando) return null;

  if (!autenticado) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Un candidato sin el perfil completo no puede ver NADA más — se le manda
  // directo a terminarlo, sin importar qué ruta haya intentado abrir.
  if (usuario?.rol === "candidato" && perfilCompletado === false && location.pathname !== "/completar-perfil") {
    return <Navigate to="/completar-perfil" replace />;
  }

  if ((nivel === "gestion" && !esGestion) || (nivel === "admin" && usuario?.rol !== "admin")) {
    return (
      <main className="page">
        <div className="card">
          <div className="notice notice--danger">No tienes permisos para ver esta sección.</div>
        </div>
      </main>
    );
  }

  return children;
}
