import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api/httpClient";
import {
  authStyles as s, IconUser, IconIdCard, IconMail, IconLock, IconArrow,
  IconEye, IconEyeOff, IconCheck, IconCheckCircleOutline,
} from "./auth/authStyles";
import logo from "../assets/logo-aguas-nacionales.png";

// Reglas reales de documentos de identidad en Colombia (fuentes: Registraduría
// Nacional y Migración Colombia). No se incluye "Tarjeta de identidad" porque
// es un documento de menores de edad — no aplica a un proceso de selección laboral.
const TIPOS_DOCUMENTO = [
  {
    valor: "Cédula de ciudadanía",
    formato: "numerico",
    min: 6,
    max: 10,
    ayuda: "Solo números, entre 6 y 10 dígitos.",
  },
  {
    valor: "Cédula de extranjería",
    formato: "numerico",
    min: 6,
    max: 9,
    ayuda: "Solo números, entre 6 y 9 dígitos.",
  },
  {
    valor: "Pasaporte",
    formato: "alfanumerico",
    min: 6,
    max: 9,
    ayuda: "Letras y números, entre 6 y 9 caracteres.",
  },
];

const CRITERIOS_PASSWORD = [
  { label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
  { label: "Una mayúscula", test: (p) => /[A-Z]/.test(p) },
  { label: "Una minúscula", test: (p) => /[a-z]/.test(p) },
  { label: "Un número", test: (p) => /[0-9]/.test(p) },
  { label: "Un carácter especial", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// Solo letras (con tildes/ñ), espacios, guion y apóstrofe — para nombres compuestos
// como "María José" o apellidos como "O'Higgins" o "De la Cruz".
function limpiarSoloLetras(valor) {
  return valor.replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ' -]/g, "");
}

function limpiarDocumento(valor, formato) {
  if (formato === "numerico") return valor.replace(/[^0-9]/g, "");
  return valor.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export default function RegistroPage() {
  const { registrar } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    tipoDocumento: TIPOS_DOCUMENTO[0].valor,
    numeroDocumento: "",
    nombres: "",
    apellidos: "",
    email: "",
    password: "",
  });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [focused, setFocused] = useState(null);
  const [btnHover, setBtnHover] = useState(false);

  const tipoDocActual = TIPOS_DOCUMENTO.find((t) => t.valor === form.tipoDocumento);

  const setCampo = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setNombreApellido = (key) => (e) => setForm((f) => ({ ...f, [key]: limpiarSoloLetras(e.target.value) }));
  const setDocumento = (e) => {
    const limpio = limpiarDocumento(e.target.value, tipoDocActual.formato).slice(0, tipoDocActual.max);
    setForm((f) => ({ ...f, numeroDocumento: limpio }));
  };
  const setTipoDocumento = (e) => {
    // Al cambiar de tipo, se re-limpia el número ya escrito con las reglas del nuevo tipo.
    const nuevoTipo = TIPOS_DOCUMENTO.find((t) => t.valor === e.target.value);
    setForm((f) => ({
      ...f,
      tipoDocumento: e.target.value,
      numeroDocumento: limpiarDocumento(f.numeroDocumento, nuevoTipo.formato).slice(0, nuevoTipo.max),
    }));
  };

  const criteriosCumplidos = CRITERIOS_PASSWORD.map((c) => c.test(form.password));
  const passwordValida = criteriosCumplidos.every(Boolean);
  const documentoValido = form.numeroDocumento.length >= tipoDocActual.min && form.numeroDocumento.length <= tipoDocActual.max;
  const formularioCompleto =
    documentoValido && form.nombres.trim() && form.apellidos.trim() &&
    form.email.trim() && passwordValida && aceptaTerminos;

  async function handleRegistro() {
    if (!formularioCompleto) {
      setError("Revisa que todos los campos sean válidos, la contraseña cumpla los requisitos, y aceptes las condiciones.");
      return;
    }
    setError("");
    setCargando(true);
    try {
      await registrar({
        nombreCompleto: `${form.nombres.trim()} ${form.apellidos.trim()}`.trim(),
        email: form.email.trim(),
        password: form.password,
        cedula: form.numeroDocumento.trim(),
      });
      navigate("/completar-perfil", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "No se pudo completar el registro.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-split__form auth-split__form--top" style={{ flex: "1 1 100%" }}>
        <div className="auth-split__form-inner" style={{ maxWidth: 440 }}>
          <div style={s.logoArea}>
            <img src={logo} alt="Aguas Nacionales EPM" style={s.logoImg} />
            <p style={s.brandTagline}>Plataforma de Selección de Personal</p>
          </div>
          <div style={s.divider} />

          <h2 style={s.heading}>Crear cuenta</h2>
          <p style={s.subheading}>Regístrate para postularte a nuestras vacantes y hacer parte de nuestro talento.</p>

          {error && <div style={s.error}>{error}</div>}

          <div style={s.field}>
            <label style={s.label}>Tipo de documento</label>
            <div style={s.inputWrap}>
              <span style={s.inputIcon}><IconIdCard /></span>
              <select style={s.select} value={form.tipoDocumento} onChange={setTipoDocumento}>
                {TIPOS_DOCUMENTO.map((t) => <option key={t.valor} value={t.valor}>{t.valor}</option>)}
              </select>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Número de documento</label>
            <div style={s.inputWrap}>
              <span style={s.inputIcon}><IconIdCard /></span>
              <input
                style={{ ...s.input, ...(focused === "doc" ? s.inputFocus : {}) }}
                type="text"
                inputMode={tipoDocActual.formato === "numerico" ? "numeric" : "text"}
                placeholder="Ingresa tu número de documento"
                value={form.numeroDocumento}
                onChange={setDocumento}
                onFocus={() => setFocused("doc")}
                onBlur={() => setFocused(null)}
              />
            </div>
            <p style={{ fontSize: 11.5, color: "#8FA79A", margin: "6px 0 0" }}>{tipoDocActual.ayuda}</p>
          </div>

          <div style={s.field}>
            <label style={s.label}>Nombres</label>
            <div style={s.inputWrap}>
              <span style={s.inputIcon}><IconUser /></span>
              <input
                style={{ ...s.input, ...(focused === "nombres" ? s.inputFocus : {}) }}
                type="text"
                placeholder="Ingresa tus nombres"
                value={form.nombres}
                onChange={setNombreApellido("nombres")}
                onFocus={() => setFocused("nombres")}
                onBlur={() => setFocused(null)}
                autoFocus
              />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Apellidos</label>
            <div style={s.inputWrap}>
              <span style={s.inputIcon}><IconUser /></span>
              <input
                style={{ ...s.input, ...(focused === "apellidos" ? s.inputFocus : {}) }}
                type="text"
                placeholder="Ingresa tus apellidos"
                value={form.apellidos}
                onChange={setNombreApellido("apellidos")}
                onFocus={() => setFocused("apellidos")}
                onBlur={() => setFocused(null)}
              />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Correo electrónico</label>
            <div style={s.inputWrap}>
              <span style={s.inputIcon}><IconMail /></span>
              <input
                style={{ ...s.input, ...(focused === "email" ? s.inputFocus : {}) }}
                type="email"
                placeholder="tu.correo@ejemplo.com"
                value={form.email}
                onChange={setCampo("email")}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                autoComplete="username"
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
                placeholder="Crea una contraseña"
                value={form.password}
                onChange={setCampo("password")}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                autoComplete="new-password"
              />
              <button type="button" style={s.inputToggle} onClick={() => setMostrarPassword((v) => !v)} tabIndex={-1} aria-label="Mostrar u ocultar contraseña">
                {mostrarPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            <div style={s.passwordChecklist}>
              {CRITERIOS_PASSWORD.map((c, i) => (
                <div key={c.label} style={{ ...s.checklistItem, ...(criteriosCumplidos[i] ? s.checklistItemOk : {}) }}>
                  {criteriosCumplidos[i] ? <IconCheck /> : <IconCheckCircleOutline />}
                  {c.label}
                </div>
              ))}
            </div>
          </div>

          <div style={s.termsRow}>
            <input
              type="checkbox"
              style={s.termsCheckbox}
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              id="acepta-terminos"
            />
            <label htmlFor="acepta-terminos" style={s.termsText}>
              Acepto la{" "}
              <Link to="/politica-datos" target="_blank" rel="noopener noreferrer" style={s.termsLink}>
                Política de Tratamiento de Datos Personales
              </Link>{" "}
              y los{" "}
              <Link to="/terminos-condiciones" target="_blank" rel="noopener noreferrer" style={s.termsLink}>
                Términos y Condiciones
              </Link>
            </label>
          </div>

          <button
            style={{
              ...s.button,
              ...(btnHover && !cargando && formularioCompleto ? s.buttonHover : {}),
              ...(cargando || !formularioCompleto ? s.buttonDisabled : {}),
            }}
            onClick={handleRegistro}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            disabled={cargando || !formularioCompleto}
          >
            {cargando ? "Creando cuenta..." : "Crear cuenta"}
            {!cargando && <IconArrow />}
          </button>

          <p style={s.switchLink}>
            ¿Ya tienes cuenta? <Link to="/login" style={{ color: "#2EA04A", fontWeight: 600 }}>Iniciar sesión</Link>
          </p>

          <div style={s.benefitsBox}>
            <p style={s.benefitsTitle}>Al crear tu cuenta, podrás:</p>
            <ul style={s.benefitsList}>
              <li style={s.benefitsItem}><IconCheck /> Postularte a vacantes</li>
              <li style={s.benefitsItem}><IconCheck /> Hacer seguimiento a tus procesos</li>
            </ul>
          </div>

          <p style={s.footer}>Aguas Nacionales EPM · Gestión Humana</p>
        </div>
      </div>
    </div>
  );
}
