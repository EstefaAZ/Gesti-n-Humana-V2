import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DocHeader from "../components/DocHeader";
import { useAuth } from "../context/AuthContext";
import * as authApi from "../lib/api/authApi";
import { ApiError } from "../lib/api/httpClient";

function iniciales(nombre) {
  if (!nombre) return "";
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function calcularFuerza(password) {
  if (!password) return { score: 0, label: "", nivel: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const etiquetas = ["Muy débil", "Débil", "Regular", "Fuerte"];
  const niveles = ["weak", "weak", "medium", "strong"];
  const idx = Math.max(0, score - 1);
  return { score, label: password.length ? etiquetas[idx] : "", nivel: niveles[idx] };
}

function IconPersona() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

function IconEscudo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
    </svg>
  );
}

function IconCamara() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}

function IconOjo({ tachado }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
      {tachado && <line x1="2" y1="22" x2="22" y2="2" />}
    </svg>
  );
}

function IconCandado() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconCuentaX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="4" />
      <path d="M2 21c0-4.4 3.6-7 8-7 1.7 0 3.2.4 4.5 1.1" />
      <line x1="16" y1="16" x2="22" y2="22" />
      <line x1="22" y1="16" x2="16" y2="22" />
    </svg>
  );
}

function IconPapelera() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </svg>
  );
}

function CampoPassword({ id, label, value, onChange, visible, onToggle, autoComplete, minLength }) {
  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={onToggle}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          <IconOjo tachado={visible} />
        </button>
      </div>
    </div>
  );
}

export default function PerfilPage() {
  const { usuario, token, actualizarUsuarioLocal, logout } = useAuth();
  const navigate = useNavigate();
  const esAdmin = usuario?.rol === "admin";

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
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [verActual, setVerActual] = useState(false);
  const [verNueva, setVerNueva] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);
  const [errorPassword, setErrorPassword] = useState("");
  const [okPassword, setOkPassword] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  const fuerza = calcularFuerza(passwordNueva);

  async function onCambiarPassword(e) {
    e.preventDefault();
    setErrorPassword("");
    setOkPassword(false);

    if (passwordNueva !== passwordConfirmar) {
      setErrorPassword("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setGuardandoPassword(true);
    try {
      await authApi.cambiarPassword(passwordActual, passwordNueva, token);
      setPasswordActual("");
      setPasswordNueva("");
      setPasswordConfirmar("");
      setOkPassword(true);
    } catch (err) {
      setErrorPassword(err instanceof ApiError ? err.detail : "No se pudo cambiar la contraseña.");
    } finally {
      setGuardandoPassword(false);
    }
  }

  // ---- Eliminar / desactivar cuenta ----
  const [errorBaja, setErrorBaja] = useState("");
  const [procesandoBaja, setProcesandoBaja] = useState(false);

  async function onEliminarCuenta() {
    if (!window.confirm("¿Eliminar tu cuenta por completo? Esta acción no se puede deshacer.")) return;
    setErrorBaja("");
    setProcesandoBaja(true);
    try {
      await authApi.eliminarCuenta(token);
      logout();
      navigate("/", { replace: true });
    } catch (err) {
      setErrorBaja(err instanceof ApiError ? err.detail : "No se pudo eliminar la cuenta.");
    } finally {
      setProcesandoBaja(false);
    }
  }

  async function onDesactivarCuenta() {
    if (!window.confirm("¿Desactivar tu cuenta? No podrás iniciar sesión hasta que la reactiven.")) return;
    setErrorBaja("");
    setProcesandoBaja(true);
    try {
      await authApi.desactivarCuenta(token);
      logout();
      navigate("/", { replace: true });
    } catch (err) {
      setErrorBaja(err instanceof ApiError ? err.detail : "No se pudo desactivar la cuenta.");
    } finally {
      setProcesandoBaja(false);
    }
  }

  return (
    <>
      <DocHeader title="Mi perfil" showCode={false} />
      <main className="page">
        <p className="section-intro" style={{ marginTop: -8 }}>
          Administra tu información personal y la seguridad de tu cuenta.
        </p>

        {/* ---------- Información personal ---------- */}
        <div className="section-card">
          <div className="section-card__header">
            <span className="section-card__icon"><IconPersona /></span>
            <div>
              <h2 className="section-card__title">Información personal</h2>
              <p className="section-card__subtitle">Actualiza tus datos personales y de contacto.</p>
            </div>
          </div>

          {errorDatos && <div className="notice notice--danger">{errorDatos}</div>}
          {okDatos && <div className="notice notice--info">Perfil actualizado.</div>}

          <form onSubmit={onGuardarDatos}>
            <div className="profile-info-layout">
              <div className="profile-info-layout__avatar">
                <div className="avatar-upload">
                  <div className="avatar-circle">{iniciales(nombreCompleto) || "?"}</div>
                  <button type="button" className="btn btn-secondary btn-sm" disabled title="Próximamente">
                    <IconCamara /> Cambiar foto
                  </button>
                </div>
              </div>

              <div className="profile-info-layout__fields">
                <div className="field" style={{ marginBottom: 14 }}>
                  <label htmlFor="nombreCompleto">Nombre completo</label>
                  <input
                    id="nombreCompleto"
                    type="text"
                    required
                    minLength={3}
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                  />
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label htmlFor="email">Correo electrónico</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="notice notice--info">
                  Este correo se utiliza para notificaciones y comunicaciones relacionadas con tus postulaciones.
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary" disabled={guardandoDatos}>
                    {guardandoDatos ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* ---------- Seguridad de la cuenta ---------- */}
        <div className="section-card mt-24">
          <div className="section-card__header">
            <span className="section-card__icon"><IconEscudo /></span>
            <div>
              <h2 className="section-card__title">Seguridad de la cuenta</h2>
              <p className="section-card__subtitle">Cambia tu contraseña periódicamente para mantener tu cuenta segura.</p>
            </div>
          </div>

          {errorPassword && <div className="notice notice--danger">{errorPassword}</div>}
          {okPassword && <div className="notice notice--info">Contraseña actualizada.</div>}

          <form onSubmit={onCambiarPassword}>
            <CampoPassword
              id="passwordActual"
              label="Contraseña actual"
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              visible={verActual}
              onToggle={() => setVerActual((v) => !v)}
              autoComplete="current-password"
            />

            <div className="field" style={{ marginBottom: passwordNueva ? 4 : 14 }}>
              <label htmlFor="passwordNueva">Nueva contraseña</label>
              <div className="password-input">
                <input
                  id="passwordNueva"
                  type={verNueva ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={passwordNueva}
                  onChange={(e) => setPasswordNueva(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setVerNueva((v) => !v)}
                  aria-label={verNueva ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <IconOjo tachado={verNueva} />
                </button>
              </div>
            </div>

            {passwordNueva && (
              <div className="pw-strength">
                <div className="pw-strength__bars">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`pw-strength__bar${i < fuerza.score ? ` is-filled level-${fuerza.nivel}` : ""}`}
                    />
                  ))}
                </div>
                <span className={`pw-strength__label level-${fuerza.nivel}`}>{fuerza.label}</span>
              </div>
            )}

            <p className="hint" style={{ display: "flex", gap: 6, alignItems: "flex-start", margin: "10px 0 20px" }}>
              <span style={{ flexShrink: 0, marginTop: 2 }}><IconCandado /></span>
              Mínimo 8 caracteres, con al menos una mayúscula, una minúscula, un número y un carácter especial.
            </p>

            <CampoPassword
              id="passwordConfirmar"
              label="Confirmar nueva contraseña"
              value={passwordConfirmar}
              onChange={(e) => setPasswordConfirmar(e.target.value)}
              visible={verConfirmar}
              onToggle={() => setVerConfirmar((v) => !v)}
              autoComplete="new-password"
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button type="submit" className="btn btn-primary" disabled={guardandoPassword}>
                <IconCandado /> {guardandoPassword ? "Cambiando…" : "Cambiar contraseña"}
              </button>
            </div>
          </form>
        </div>

        {/* ---------- Eliminar / desactivar cuenta ---------- */}
        <div className="section-card section-card--danger mt-24">
          <div className="section-card__header">
            <span className="section-card__icon section-card__icon--danger"><IconCuentaX /></span>
            <div>
              <h2 className="section-card__title section-card__title--danger">
                {esAdmin ? "Eliminar cuenta" : "Desactivar cuenta"}
              </h2>
              <p className="section-card__subtitle">
                {esAdmin
                  ? "Esta acción es permanente y no se puede deshacer."
                  : "Podrás solicitar que la reactiven más adelante."}
              </p>
            </div>
          </div>

          <p className="text-muted" style={{ fontSize: 13 }}>
            {esAdmin
              ? "Al eliminar tu cuenta, se borrarán de forma permanente todos tus datos y postulaciones. Tus postulaciones no se borran automáticamente junto con la cuenta. Elimínalas primero desde \"Mis postulaciones\" si también quieres borrarlas."
              : "Al desactivar tu cuenta, no podrás iniciar sesión ni postularte a nuevas vacantes hasta que Gestión Humana la reactive. Tus postulaciones actuales se conservan."}
          </p>

          {errorBaja && <div className="notice notice--danger">{errorBaja}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={esAdmin ? onEliminarCuenta : onDesactivarCuenta}
              disabled={procesandoBaja}
            >
              <IconPapelera />{" "}
              {procesandoBaja
                ? esAdmin ? "Eliminando…" : "Desactivando…"
                : esAdmin ? "Eliminar mi cuenta" : "Desactivar mi cuenta"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
