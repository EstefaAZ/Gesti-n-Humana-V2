import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../lib/api/authApi";
import * as perfilesApi from "../lib/api/perfilesApi";

const STORAGE_KEY = "auth_session";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  // null = todavía no se sabe (o no aplica, ej. gestor_humano/admin); true/false una vez que se consulta.
  const [perfilCompletado, setPerfilCompletado] = useState(null);

  async function _consultarEstadoPerfil(t, u) {
    if (!u || u.rol !== "candidato") {
      setPerfilCompletado(true); // no aplica para gestor_humano/admin
      return;
    }
    try {
      const estado = await perfilesApi.obtenerEstado(t);
      setPerfilCompletado(estado.completado);
    } catch {
      // Si falla la consulta (ej. backend caído), no bloqueamos al candidato con un valor incorrecto.
      setPerfilCompletado(true);
    }
  }

  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado) {
      try {
        const { token: t, usuario: u } = JSON.parse(guardado);
        setToken(t);
        setUsuario(u);
        _consultarEstadoPerfil(t, u);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setCargando(false);
  }, []);

  function _guardarSesion(t, u) {
    setToken(t);
    setUsuario(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, usuario: u }));
    _consultarEstadoPerfil(t, u);
  }

  function actualizarUsuarioLocal(nuevoUsuario) {
    setUsuario(nuevoUsuario);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, usuario: nuevoUsuario }));
  }

  async function login(email, password, recordar = false) {
    const { token: t, usuario: u } = await authApi.login(email, password, recordar);
    _guardarSesion(t, u);
    return u;
  }

  async function registrar(datos) {
    await authApi.registrar(datos);
    // El registro público siempre crea un candidato; iniciamos sesión de una vez.
    return login(datos.email, datos.password);
  }

  async function refrescarEstadoPerfil() {
    await _consultarEstadoPerfil(token, usuario);
  }

  function logout() {
    setToken(null);
    setUsuario(null);
    setPerfilCompletado(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  const value = {
    token,
    usuario,
    cargando,
    autenticado: !!token,
    esGestion: usuario?.rol === "gestor_humano" || usuario?.rol === "admin",
    perfilCompletado,
    refrescarEstadoPerfil,
    login,
    registrar,
    logout,
    actualizarUsuarioLocal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
