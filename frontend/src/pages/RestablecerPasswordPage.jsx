import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import * as authApi from "../lib/api/authApi";
import { ApiError } from "../lib/api/httpClient";
import { authStyles as s, IconLock, IconArrow, IconEye, IconEyeOff } from "./auth/authStyles";
import logo from "../assets/logo-aguas-nacionales.png";

export default function RestablecerPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [passwordNueva, setPasswordNueva] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [focused, setFocused] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  async function handleRestablecer() {
    if (!passwordNueva.trim()) {
      setError("Ingresa tu nueva contraseña.");
      return;
    }
    setError("");
    setCargando(true);
    try {
      await authApi.restablecerPassword(token, passwordNueva);
      navigate("/login", { replace: true, state: { restablecida: true } });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "No se pudo restablecer la contraseña.");
    } finally {
      setCargando(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") handleRestablecer();
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoArea}>
          <img src={logo} alt="Aguas Nacionales EPM" style={s.logoImg} />
          <p style={s.brandTagline}>Plataforma de Selección de Personal</p>
        </div>
        <div style={s.divider} />

        <h2 style={s.heading}>Crear nueva contraseña</h2>
        <p style={s.subheading}>Elige una contraseña nueva para tu cuenta.</p>

        {!token && <div style={s.error}>Este enlace no es válido. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".</div>}
        {error && <div style={s.error}>{error}</div>}

        {token && (
          <>
            <div style={{ ...s.field, marginBottom: "22px" }}>
              <label style={s.label}>Nueva contraseña</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}><IconLock /></span>
                <input
                  style={{ ...s.input, paddingRight: "44px", ...(focused ? s.inputFocus : {}) }}
                  type={mostrarPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres, con un número"
                  value={passwordNueva}
                  onChange={(e) => setPasswordNueva(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={onKeyDown}
                  autoFocus
                />
                <button type="button" style={s.inputToggle} onClick={() => setMostrarPassword((v) => !v)} tabIndex={-1} aria-label="Mostrar u ocultar contraseña">
                  {mostrarPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            <button
              style={{ ...s.button, ...(btnHover && !cargando ? s.buttonHover : {}), ...(cargando ? s.buttonDisabled : {}) }}
              onClick={handleRestablecer}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              disabled={cargando}
            >
              {cargando ? "Guardando..." : "Restablecer contraseña"}
              {!cargando && <IconArrow />}
            </button>
          </>
        )}

        <p style={s.switchLink}>
          <Link to="/login" style={{ color: "#2EA04A", fontWeight: 600 }}>Volver a iniciar sesión</Link>
        </p>

        <p style={s.footer}>Aguas Nacionales EPM · Gestión Humana</p>
      </div>
    </div>
  );
}
