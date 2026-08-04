import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import { useAuth } from "../context/AuthContext";
import * as authApi from "../lib/api/authApi";
import { ApiError } from "../lib/api/httpClient";

const ETIQUETAS_ROL = { candidato: "Candidato", gestor_humano: "Gestión Humana", admin: "Administrador" };

export default function PerfilPage() {
  const { usuario, token, actualizarUsuarioLocal, logout } = useAuth();
  const navigate = useNavigate();

  // ---- Datos personales ----
  const [nombreCompleto, setNombreCompleto] = useState(usuario?.nombreCompleto || "");
  const [email, setEmail] = useState(usuario?.email || "");
  const [errorDatos, setErrorDatos] = useState("");
  const [okDatos, setOkDatos] = useState(false);
  const [guardandoDatos, setGuardandoDatos] = useState(false);

  async function onGuardarDatos(e) {
    e.preventDefault();
    setErrorDatos("");
    setOkDatos(false);
    setGuardandoDatos(true);
    try {
      const actualizado = await authApi.actualizarPerfil({ nombreCompleto, email }, token);
      actualizarUsuarioLocal(actualizado);
      setOkDatos(true);
    } catch (err) {
      setErrorDatos(err instanceof ApiError ? err.detail : "No se pudo actualizar el perfil.");
    } finally {
      setGuardandoDatos(false);
    }
  }

  // ---- Cambiar contraseña ----
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [okPassword, setOkPassword] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  async function onCambiarPassword(e) {
    e.preventDefault();
    setErrorPassword("");
    setOkPassword(false);
    setGuardandoPassword(true);
    try {
      await authApi.cambiarPassword(passwordActual, passwordNueva, token);
      setPasswordActual("");
      setPasswordNueva("");
      setOkPassword(true);
    } catch (err) {
      setErrorPassword(err instanceof ApiError ? err.detail : "No se pudo cambiar la contraseña.");
    } finally {
      setGuardandoPassword(false);
    }
  }

  // ---- Eliminar cuenta ----
  const [errorEliminar, setErrorEliminar] = useState("");
  const [eliminando, setEliminando] = useState(false);

  async function onEliminarCuenta() {
    if (!window.confirm("¿Eliminar tu cuenta por completo? Esta acción no se puede deshacer.")) return;
    setErrorEliminar("");
    setEliminando(true);
    try {
      await authApi.eliminarCuenta(token);
      logout();
      navigate("/", { replace: true });
    } catch (err) {
      setErrorEliminar(err instanceof ApiError ? err.detail : "No se pudo eliminar la cuenta.");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <>
      <DocHeader title="Mi perfil" showCode={false} />
      <main className="page">
        <div className="card auth-card">
          <h2 className="section-title">Datos personales</h2>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8 }}>
            Rol: {ETIQUETAS_ROL[usuario?.rol] || usuario?.rol}
          </p>

          {errorDatos && <div className="notice notice--danger">{errorDatos}</div>}
          {okDatos && <div className="notice notice--info">Perfil actualizado.</div>}

          <form onSubmit={onGuardarDatos}>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Nombre completo</label>
              <input type="text" required minLength={3} value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Correo electrónico</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={guardandoDatos}>
              {guardandoDatos ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
        </div>

        <div className="card auth-card mt-24">
          <h2 className="section-title">Cambiar contraseña</h2>

          {errorPassword && <div className="notice notice--danger">{errorPassword}</div>}
          {okPassword && <div className="notice notice--info">Contraseña actualizada.</div>}

          <form onSubmit={onCambiarPassword}>
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Contraseña actual</label>
              <input type="password" required value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Contraseña nueva</label>
              <input type="password" required minLength={8} value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} />
              <span className="hint">Mínimo 8 caracteres, con al menos un número.</span>
            </div>
            <button type="submit" className="btn btn-primary" disabled={guardandoPassword}>
              {guardandoPassword ? "Cambiando…" : "Cambiar contraseña"}
            </button>
          </form>
        </div>

        <div className="card auth-card mt-24">
          <h2 className="section-title" style={{ color: "var(--color-danger)" }}>Eliminar cuenta</h2>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Esto elimina tu cuenta por completo, de forma permanente. Tus postulaciones no se borran
            automáticamente junto con la cuenta. Elimínalas primero desde "Mis postulaciones" si también
            quieres borrarlas.
          </p>
          {errorEliminar && <div className="notice notice--danger">{errorEliminar}</div>}
          <button type="button" className="btn btn-secondary" style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }} onClick={onEliminarCuenta} disabled={eliminando}>
            {eliminando ? "Eliminando…" : "Eliminar mi cuenta"}
          </button>
        </div>
      </main>
    </>
  );
}
