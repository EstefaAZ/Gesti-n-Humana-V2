import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api/httpClient";
import { authStyles as s, IconMail, IconLock, IconArrow, IconEye, IconEyeOff, IconUser } from "./auth/authStyles";
import logo from "../assets/logo-aguas-nacionales.png";
import fotoPlanta from "../assets/login-foto-provisional.jpg";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recordar, setRecordar] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [restablecida] = useState(!!location.state?.restablecida);
  const [cargando, setCargando] = useState(false);
  const [focused, setFocused] = useState(null);
  const [btnHover, setBtnHover] = useState(false);
  const [btn2Hover, setBtn2Hover] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Por favor ingresa tu correo y contraseña.");
      return;
    }
    setError("");
    setCargando(true);
    try {
      await login(email.trim(), password, recordar);
      const destino = location.state?.from?.pathname || "/";
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") handleLogin();
  }

  return (
    <div className="auth-split">
      {/* Columna izquierda — foto PROVISIONAL de la web de la empresa, a la espera de la que defina el área de Diseño */}
      <div className="auth-split__photo">
        <img src={fotoPlanta} alt="Instalaciones de Aguas Nacionales EPM" />
        <div className="auth-split__photo-overlay" />
        <div className="auth-split__photo-logo">
          <img src={logo} alt="Aguas Nacionales EPM" />
        </div>
        <div className="auth-split__photo-caption">
          <h2>Transformamos vidas y entornos para un futuro sostenible</h2>
          <p>En Aguas Nacionales EPM creemos en el talento que inspira, que transforma y que construye un mejor país.</p>
        </div>
        <span className="auth-split__photo-tag">Foto provisional</span>
      </div>

      {/* Columna derecha — formulario */}
      <div className="auth-split__form">
        <div className="auth-split__form-inner">
          <div className="auth-split__mobile-logo">
            <img src={logo} alt="Aguas Nacionales EPM" />
            <p style={s.brandTagline}>Plataforma de Selección de Personal</p>
          </div>

          <h2 style={s.heading}>Bienvenido</h2>
          <p style={s.subheading}>Accede para ver las convocatorias abiertas y gestionar tus postulaciones.</p>

          {error && <div style={s.error}>{error}</div>}
          {restablecida && <div style={s.success}>Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.</div>}

          <div style={s.field}>
            <label style={s.label}>Correo electrónico</label>
            <div style={s.inputWrap}>
              <span style={s.inputIcon}><IconMail /></span>
              <input
                style={{ ...s.input, ...(focused === "email" ? s.inputFocus : {}) }}
                type="email"
                placeholder="tu.correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                onKeyDown={onKeyDown}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <div style={s.inputWrap}>
              <span style={s.inputIcon}><IconLock /></span>
              <input
                style={{ ...s.input, paddingRight: "44px", ...(focused === "password" ? s.inputFocus : {}) }}
                type={mostrarPassword ? "text" : "password"}
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onKeyDown={onKeyDown}
                autoComplete="current-password"
              />
              <button type="button" style={s.inputToggle} onClick={() => setMostrarPassword((v) => !v)} tabIndex={-1} aria-label="Mostrar u ocultar contraseña">
                {mostrarPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          <div style={s.optionsRow}>
            <label style={s.checkboxLabel}>
              <input type="checkbox" style={s.checkbox} checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
              Recordarme
            </label>
            <Link to="/olvide-password" style={s.forgotLink}>¿Olvidaste tu contraseña?</Link>
          </div>

          <button
            style={{ ...s.button, ...(btnHover && !cargando ? s.buttonHover : {}), ...(cargando ? s.buttonDisabled : {}) }}
            onClick={handleLogin}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            disabled={cargando}
          >
            {cargando ? "Ingresando..." : "Iniciar sesión"}
            {!cargando && <IconArrow />}
          </button>

          <div style={s.dividerOr}>
            <span style={s.dividerOrLine} />
            o
            <span style={s.dividerOrLine} />
          </div>

          <Link
            to="/registro"
            style={{ ...s.buttonSecondary, ...(btn2Hover ? s.buttonSecondaryHover : {}) }}
            onMouseEnter={() => setBtn2Hover(true)}
            onMouseLeave={() => setBtn2Hover(false)}
          >
            <IconUser /> Crear cuenta
          </Link>

          <p style={s.footer}>Aguas Nacionales EPM · Gestión Humana</p>
        </div>
      </div>
    </div>
  );
}
