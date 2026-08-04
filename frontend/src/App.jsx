import { Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import ListaVacantesPage from "./pages/ListaVacantesPage";
import VacanteDetallePage from "./pages/VacanteDetallePage";
import SolicitudPage from "./pages/SolicitudPage";
import MisPostulacionesPage from "./pages/MisPostulacionesPage";
import PerfilPage from "./pages/PerfilPage";
import LoginPage from "./pages/LoginPage";
import RegistroPage from "./pages/RegistroPage";
import OlvidePasswordPage from "./pages/OlvidePasswordPage";
import RestablecerPasswordPage from "./pages/RestablecerPasswordPage";
import PoliticaDatosPage from "./pages/PoliticaDatosPage";
import TerminosCondicionesPage from "./pages/TerminosCondicionesPage";
import GestionHumanaPage from "./pages/hr/GestionHumanaPage";
import DashboardPage from "./pages/hr/DashboardPage";
import UsuariosPage from "./pages/hr/UsuariosPage";
import AuditoriaPage from "./pages/hr/AuditoriaPage";

function AppShell() {
  const { autenticado, cargando } = useAuth();

  if (cargando) return null; // evita el parpadeo mientras se restaura la sesión guardada

  const rutas = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/olvide-password" element={<OlvidePasswordPage />} />
      <Route path="/restablecer-password" element={<RestablecerPasswordPage />} />
      <Route path="/politica-datos" element={<PoliticaDatosPage />} />
      <Route path="/terminos-condiciones" element={<TerminosCondicionesPage />} />

      {/* Todo lo demás exige sesión iniciada — nada se ve sin hacer login primero */}
      <Route path="/" element={<ProtectedRoute nivel="cualquiera"><ListaVacantesPage /></ProtectedRoute>} />
      <Route path="/vacante/:id" element={<ProtectedRoute nivel="cualquiera"><VacanteDetallePage /></ProtectedRoute>} />
      <Route path="/postularme/:id" element={<ProtectedRoute nivel="cualquiera"><SolicitudPage /></ProtectedRoute>} />
      <Route path="/mis-postulaciones" element={<ProtectedRoute nivel="cualquiera"><MisPostulacionesPage /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute nivel="cualquiera"><PerfilPage /></ProtectedRoute>} />
      <Route path="/gestion-humana" element={<ProtectedRoute nivel="gestion"><GestionHumanaPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute nivel="admin"><DashboardPage /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute nivel="admin"><UsuariosPage /></ProtectedRoute>} />
      <Route path="/auditoria" element={<ProtectedRoute nivel="admin"><AuditoriaPage /></ProtectedRoute>} />
    </Routes>
  );

  if (!autenticado) return rutas; // login/registro/etc. siguen a pantalla completa, sin sidebar

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell__main">{rutas}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
