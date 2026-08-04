import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * @param {"cualquiera"|"gestion"|"admin"} nivel - "cualquiera": solo requiere estar logueado.
 *   "gestion": requiere rol gestor_humano o admin. "admin": requiere específicamente admin.
 */
export default function ProtectedRoute({ nivel = "cualquiera", children }) {
  const { autenticado, esGestion, usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return null;

  if (!autenticado) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
