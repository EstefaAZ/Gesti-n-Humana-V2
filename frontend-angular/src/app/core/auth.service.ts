import { Injectable, computed, signal } from '@angular/core';
import * as authApi from '../lib/api/authApi';
import * as perfilesApi from '../lib/api/perfilesApi';
import { ApiError, alExpirarSesion } from '../lib/api/httpClient';

const STORAGE_KEY = 'auth_session';
// Si la consulta del estado del perfil falla, se reintenta una vez tras este tiempo.
const REINTENTO_ESTADO_MS = 4000;

/**
 * La cuenta SÍ se creó, pero falló el inicio de sesión automático (red, límite
 * de intentos…). Quien llama debe mandar al login, no dejar reintentar el registro
 * (el reintento respondería "el correo ya está registrado").
 */
export class RegistroSinSesionError extends Error {
  constructor(readonly causa: unknown) {
    super('La cuenta se creó, pero no se pudo iniciar sesión automáticamente.');
  }
}

/**
 * Equivalente del AuthContext de React: sesión (token + usuario) guardada en
 * localStorage y estado del perfil del candidato.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly token = signal<string | null>(null);
  readonly usuario = signal<any>(null);
  // null = todavía no se sabe (o no aplica, ej. gestor_humano/admin); true/false una vez que se consulta.
  readonly perfilCompletado = signal<boolean | null>(null);
  /** true cuando se cerró la sesión porque el servidor rechazó el token (el login muestra un aviso). */
  readonly sesionExpirada = signal(false);

  /**
   * true si la última consulta del estado del perfil falló (servidor caído, red…).
   * Mientras tanto se deja pasar al candidato —el backend igual rechaza inscripciones
   * con el perfil incompleto— y se vuelve a consultar al navegar.
   */
  private estadoEnDuda = false;
  private consultando = false;
  private reintentoProgramado: ReturnType<typeof setTimeout> | null = null;

  readonly autenticado = computed(() => !!this.token());
  readonly esGestion = computed(() => {
    const rol = this.usuario()?.rol;
    return rol === 'gestor_humano' || rol === 'admin';
  });

  constructor() {
    // Token vencido o inválido en CUALQUIER llamada a la API: se cierra la sesión y
    // el efecto de app.ts manda al login (recordando a dónde iba).
    alExpirarSesion(() => this._cerrarPorSesionExpirada());

    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado) {
      try {
        const { token: t, usuario: u } = JSON.parse(guardado);
        this.token.set(t);
        this.usuario.set(u);
        this._consultarEstadoPerfil(t, u);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  // Consulta del estado del perfil en curso (o ya resuelta). El guard la espera
  // cuando perfilCompletado todavía es null, para no mostrar una página protegida
  // un instante antes de mandar al candidato a /completar-perfil.
  private estadoPerfil: Promise<void> = Promise.resolve();

  esperarEstadoPerfil(): Promise<void> {
    return this.estadoPerfil;
  }

  private _consultarEstadoPerfil(t: string | null, u: any): Promise<void> {
    this.estadoPerfil = this._pedirEstadoPerfil(t, u);
    return this.estadoPerfil;
  }

  private async _pedirEstadoPerfil(t: string | null, u: any): Promise<void> {
    if (!u || u.rol !== 'candidato') {
      this.perfilCompletado.set(true); // no aplica para gestor_humano/admin
      return;
    }
    this.consultando = true;
    try {
      const estado = await perfilesApi.obtenerEstado(t);
      if (this.token() !== t) return; // la sesión cambió mientras tanto
      this.perfilCompletado.set(estado.completado);
      this.estadoEnDuda = false;
    } catch (e) {
      if (this.token() !== t) return;
      // 401 de token inválido: alExpirarSesion ya cerró la sesión; no hay nada que decidir.
      if (e instanceof ApiError && e.status === 401 && !this.autenticado()) return;

      // Servidor caído, sin red o respuesta inesperada: se deja pasar (el backend es
      // quien de verdad bloquea inscribirse con el perfil incompleto), pero se deja
      // rastro en consola —así no pasa desapercibido algo como un puerto mal
      // configurado— y se vuelve a intentar.
      console.warn('[auth] No se pudo consultar el estado del perfil; se deja pasar y se reintentará.', e);
      // Si ya se sabía el estado (true o false), se conserva; solo se asume "completo" si no se sabía nada.
      if (this.perfilCompletado() === null) this.perfilCompletado.set(true);
      this.estadoEnDuda = true;
      this._programarReintento(t, u);
    } finally {
      this.consultando = false;
    }
  }

  /** Un único reintento automático; los siguientes los dispara la navegación (revisarEstadoSiQuedoEnDuda). */
  private _programarReintento(t: string | null, u: any): void {
    if (this.reintentoProgramado) return;
    this.reintentoProgramado = setTimeout(() => {
      this.reintentoProgramado = null;
      if (this.token() === t && this.estadoEnDuda && !this.consultando) this._consultarEstadoPerfil(t, u);
    }, REINTENTO_ESTADO_MS);
  }

  /**
   * Lo llama el guard en cada navegación: si la última consulta falló, vuelve a
   * consultar en segundo plano (sin frenar la navegación). Si resulta que el perfil
   * está incompleto, el efecto de app.ts redirige a /completar-perfil.
   */
  revisarEstadoSiQuedoEnDuda(): void {
    if (this.estadoEnDuda && !this.consultando && this.autenticado()) {
      this._consultarEstadoPerfil(this.token(), this.usuario());
    }
  }

  private _cerrarPorSesionExpirada(): void {
    if (!this.autenticado()) return;
    this.logout();
    this.sesionExpirada.set(true);
  }

  private _guardarSesion(t: string, u: any): void {
    this.sesionExpirada.set(false);
    this.estadoEnDuda = false;
    this.token.set(t);
    this.usuario.set(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, usuario: u }));
    this._consultarEstadoPerfil(t, u);
  }

  actualizarUsuarioLocal(nuevoUsuario: any): void {
    this.usuario.set(nuevoUsuario);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: this.token(), usuario: nuevoUsuario }));
  }

  async login(email: string, password: string, recordar = false): Promise<any> {
    const { token: t, usuario: u } = await authApi.login(email, password, recordar);
    this._guardarSesion(t, u);
    return u;
  }

  async registrar(datos: { nombreCompleto: string; email: string; password: string; cedula?: string }): Promise<any> {
    await authApi.registrar(datos);
    // El registro público siempre crea un candidato; iniciamos sesión de una vez.
    try {
      return await this.login(datos.email, datos.password);
    } catch (e) {
      throw new RegistroSinSesionError(e);
    }
  }

  async refrescarEstadoPerfil(): Promise<void> {
    await this._consultarEstadoPerfil(this.token(), this.usuario());
  }

  logout(): void {
    this.token.set(null);
    this.usuario.set(null);
    this.perfilCompletado.set(null);
    this.sesionExpirada.set(false);
    this.estadoEnDuda = false;
    if (this.reintentoProgramado) {
      clearTimeout(this.reintentoProgramado);
      this.reintentoProgramado = null;
    }
    localStorage.removeItem(STORAGE_KEY);
  }
}
