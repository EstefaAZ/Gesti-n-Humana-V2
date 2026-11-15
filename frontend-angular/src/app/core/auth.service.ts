import { Injectable, computed, signal } from '@angular/core';
import * as authApi from '../lib/api/authApi';
import * as perfilesApi from '../lib/api/perfilesApi';

const STORAGE_KEY = 'auth_session';

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

  readonly autenticado = computed(() => !!this.token());
  readonly esGestion = computed(() => {
    const rol = this.usuario()?.rol;
    return rol === 'gestor_humano' || rol === 'admin';
  });

  constructor() {
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

  private async _consultarEstadoPerfil(t: string | null, u: any): Promise<void> {
    if (!u || u.rol !== 'candidato') {
      this.perfilCompletado.set(true); // no aplica para gestor_humano/admin
      return;
    }
    try {
      const estado = await perfilesApi.obtenerEstado(t);
      this.perfilCompletado.set(estado.completado);
    } catch {
      // Si falla la consulta (ej. backend caído), no bloqueamos al candidato con un valor incorrecto.
      this.perfilCompletado.set(true);
    }
  }

  private _guardarSesion(t: string, u: any): void {
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
    return this.login(datos.email, datos.password);
  }

  async refrescarEstadoPerfil(): Promise<void> {
    await this._consultarEstadoPerfil(this.token(), this.usuario());
  }

  logout(): void {
    this.token.set(null);
    this.usuario.set(null);
    this.perfilCompletado.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }
}
