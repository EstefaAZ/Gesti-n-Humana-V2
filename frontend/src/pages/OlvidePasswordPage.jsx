import { useState } from "react";
import { Link } from "react-router-dom";
import * as authApi from "../lib/api/authApi";
import { ApiError } from "../lib/api/httpClient";
import { authStyles as s, IconMail, IconArrowLeft, IconShield, IconLockBadge } from "./auth/authStyles";
import logo from "../assets/logo-aguas-nacionales.png";

export default function OlvidePasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enlaceDev, setEnlaceDev] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [focused, setFocused] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  async function handleEnviar() {
    if (!email.trim()) {
      setError("Ingresa tu correo electrónico.");
      return;
    }
    setError("");
    setCargando(true);
    try {
      const resp = await authApi.olvidePassword(email.trim());
      setEnviado(true);
      if (resp.token_dev) {
        setEnlaceDev(`${window.location.origin}/restablecer-password?token=${resp.token_dev}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "No se pudo procesar la solicitud.");
    } finally {
      setCargando(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") handleEnviar();
  }

  return (
    <div className="auth-split">
      <div className="auth-split__form" style={{ flex: "1 1 100%" }}>
        <div className="auth-split__form-inner">
          <div style={s.logoArea}>
            <img src={logo} alt="Aguas Nacionales EPM" style={s.logoImg} />
            <p style={s.brandTagline}>Plataforma de Selección de Personal</p>
          </div>
          <div style={s.divider} />

          <div style={s.illustrationCircle}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            <span style={s.illustrationBadge}><IconLockBadge /></span>
          </div>

          <h2 style={{ ...s.heading, textAlign: "center" }}>¿Olvidaste tu contraseña?</h2>
          <p style={{ ...s.subheading, textAlign: "center" }}>
            No te preocupes, te ayudamos a recuperarla. Ingresa tu correo electrónico y te enviaremos las
            instrucciones para restablecer tu contraseña.
          </p>

          {error && <div style={s.error}>{error}</div>}

          {enviado ? (
            <>
              <div style={s.success}>
                Si el correo está registrado, en breve recibirás un enlace para restablecer tu contraseña.
                {enlaceDev && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>
                      (Solo en desarrollo — todavía no hay envío de correo real)
                    </div>
                    <a href={enlaceDev} style={{ color: "#004D20", fontWeight: 700, wordBreak: "break-all" }}>
                      {enlaceDev}
                    </a>
                  </div>
                )}
              </div>
              <div style={s.tipBox}>
                <IconShield />
                <span>Si no recibes el correo en los próximos minutos, revisa tu bandeja de spam o correo no deseado.</span>
              </div>
            </>
          ) : (
            <>
              <div style={s.field}>
                <label style={s.label}>Correo electrónico</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}><IconMail /></span>
                  <input
                    style={{ ...s.input, ...(focused ? s.inputFocus : {}) }}
                    type="email"
                    placeholder="Ingresa tu correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={onKeyDown}
                    autoFocus
                  />
                </div>
              </div>

              <button
                style={{ ...s.button, ...(btnHover && !cargando ? s.buttonHover : {}), ...(cargando ? s.buttonDisabled : {}) }}
                onClick={handleEnviar}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                disabled={cargando}
              >
                {cargando ? "Enviando..." : "Enviar instrucciones"}
              </button>

              <div style={s.tipBox}>
                <IconShield />
                <span>Si no recibes el correo en los próximos minutos, revisa tu bandeja de spam o correo no deseado.</span>
              </div>
            </>
          )}

          <p style={{ ...s.switchLink, marginTop: 22 }}>
            <Link to="/login" style={{ ...s.forgotLink, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconArrowLeft /> Volver al inicio de sesión
            </Link>
          </p>

          <p style={s.footer}>© {new Date().getFullYear()} Aguas Nacionales EPM S.A. E.S.P.</p>
        </div>
      </div>
    </div>
  );
}
