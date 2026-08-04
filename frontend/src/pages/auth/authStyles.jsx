// ==========================================================================
// Estética compartida de las páginas de autenticación — tema CLARO
// institucional (mismo lenguaje visual que el resto del sitio: Georgia para
// títulos, verdes de marca, campos con borde suave), con el logo real de
// Aguas Nacionales.
// ==========================================================================

export const GREEN_ACCENT = "#2EA04A";
export const GREEN_ACCENT_GLOW = "rgba(46,160,74,0.16)";
export const GREEN_PRIMARY = "#006228";
export const GREEN_PRIMARY_DARK = "#004D20";

export const authStyles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#F4F7F6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
    padding: "24px",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid #E2EAE5",
    borderRadius: "16px",
    boxShadow: "0 12px 40px rgba(0,77,32,0.08)",
    padding: "40px 40px 32px",
    width: "100%",
    maxWidth: "420px",
  },
  logoArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "20px",
  },
  logoImg: {
    height: "42px",
    width: "auto",
    marginBottom: "10px",
  },
  brandTagline: {
    fontSize: "12.5px",
    color: "#5B6B60",
    margin: 0,
    textAlign: "center",
  },
  divider: {
    height: "1px",
    background: "#EDF2F0",
    marginBottom: "24px",
  },
  heading: {
    fontFamily: "var(--font-display)",
    fontSize: "20px",
    fontWeight: 700,
    color: GREEN_PRIMARY_DARK,
    margin: "0 0 4px",
  },
  subheading: {
    fontSize: "13px",
    color: "#5B6B60",
    margin: "0 0 22px",
  },
  field: {
    marginBottom: "18px",
  },
  label: {
    display: "block",
    fontSize: "11.5px",
    fontWeight: "600",
    color: "#5B6B60",
    marginBottom: "7px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  inputWrap: {
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#8FA79A",
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
  },
  inputToggle: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    padding: "4px",
    color: "#8FA79A",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: "13px 14px 13px 40px",
    background: "#FFFFFF",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#D8E7DC",
    borderRadius: "10px",
    color: "#1B2B22",
    fontSize: "14.5px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  inputFocus: {
    borderColor: GREEN_ACCENT,
    boxShadow: `0 0 0 3px ${GREEN_ACCENT_GLOW}`,
  },
  optionsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "22px",
    marginTop: "-6px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "13px",
    color: "#5B6B60",
    cursor: "pointer",
    userSelect: "none",
  },
  checkbox: {
    width: "15px",
    height: "15px",
    accentColor: GREEN_PRIMARY,
    cursor: "pointer",
  },
  forgotLink: {
    fontSize: "13px",
    color: GREEN_ACCENT,
    fontWeight: 600,
    textDecoration: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  button: {
    width: "100%",
    padding: "14px",
    background: GREEN_PRIMARY,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: GREEN_PRIMARY,
    borderRadius: "10px",
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: "600",
    fontFamily: "inherit",
    cursor: "pointer",
    letterSpacing: "0.01em",
    transition: "background 0.2s, border-color 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxSizing: "border-box",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    margin: 0,
  },
  buttonHover: {
    background: GREEN_PRIMARY_DARK,
    borderColor: GREEN_PRIMARY_DARK,
  },
  buttonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  buttonSecondary: {
    width: "100%",
    padding: "13px",
    background: "#FFFFFF",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: GREEN_ACCENT,
    borderRadius: "10px",
    color: GREEN_PRIMARY_DARK,
    fontSize: "14.5px",
    fontWeight: "600",
    fontFamily: "inherit",
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxSizing: "border-box",
  },
  buttonSecondaryHover: {
    background: "#EDF8EF",
  },
  error: {
    background: "#FAEAE9",
    border: "1px solid rgba(178,58,52,0.25)",
    borderRadius: "10px",
    color: "#B23A34",
    padding: "12px 16px",
    fontSize: "13.5px",
    marginBottom: "18px",
    textAlign: "center",
  },
  success: {
    background: "#EDF8EF",
    border: "1px solid rgba(46,160,74,0.3)",
    borderRadius: "10px",
    color: GREEN_PRIMARY_DARK,
    padding: "12px 16px",
    fontSize: "13.5px",
    marginBottom: "18px",
    textAlign: "center",
  },
  dividerOr: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "20px 0",
    color: "#8FA79A",
    fontSize: "12px",
  },
  dividerOrLine: {
    flex: 1,
    height: "1px",
    background: "#E2EAE5",
  },
  switchLink: {
    textAlign: "center",
    marginTop: "18px",
    fontSize: "13px",
    color: "#5B6B60",
  },
  footer: {
    textAlign: "center",
    marginTop: "22px",
    color: "#A9BBB0",
    fontSize: "10.5px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "#5B6B60",
    textDecoration: "none",
    marginBottom: "18px",
  },
  select: {
    width: "100%",
    padding: "13px 14px 13px 40px",
    background: "#FFFFFF",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#D8E7DC",
    borderRadius: "10px",
    color: "#1B2B22",
    fontSize: "14.5px",
    outline: "none",
    boxSizing: "border-box",
    appearance: "auto",
  },
  passwordChecklist: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "5px 12px",
    margin: "10px 0 0",
  },
  checklistItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#8FA79A",
  },
  checklistItemOk: {
    color: GREEN_PRIMARY_DARK,
  },
  termsRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
    margin: "4px 0 20px",
  },
  termsCheckbox: {
    width: "15px",
    height: "15px",
    marginTop: "2px",
    accentColor: GREEN_PRIMARY,
    cursor: "pointer",
    flexShrink: 0,
  },
  termsText: {
    fontSize: "12.5px",
    color: "#5B6B60",
    lineHeight: 1.5,
  },
  termsLink: {
    color: GREEN_ACCENT,
    fontWeight: 600,
    textDecoration: "underline",
  },
  benefitsBox: {
    background: "#EDF8EF",
    borderRadius: "12px",
    padding: "16px 18px",
    marginTop: "22px",
  },
  benefitsTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: GREEN_PRIMARY_DARK,
    margin: "0 0 8px",
  },
  benefitsList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  benefitsItem: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "12.5px",
    color: "#3A5A44",
  },
  illustrationCircle: {
    width: "84px",
    height: "84px",
    borderRadius: "50%",
    background: "#EDF8EF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    position: "relative",
    color: GREEN_PRIMARY,
  },
  illustrationBadge: {
    position: "absolute",
    bottom: "-2px",
    right: "-2px",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: GREEN_PRIMARY,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tipBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
    background: "#EDF8EF",
    borderRadius: "10px",
    padding: "12px 14px",
    marginTop: "18px",
    fontSize: "12px",
    color: "#3A5A44",
    lineHeight: 1.5,
  },
};

export const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const IconIdCard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <circle cx="8.5" cy="12" r="1.8" />
    <path d="M13.5 10h5M13.5 14h3.5" />
  </svg>
);

export const IconArrow = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export const IconArrowLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const IconEye = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconEyeOff = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
);

export const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const IconCheckCircleOutline = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
  </svg>
);

export const IconShield = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
  </svg>
);

export const IconLockBadge = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
