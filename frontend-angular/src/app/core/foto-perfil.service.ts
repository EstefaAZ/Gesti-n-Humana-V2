import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth.service';
import * as authApi from '../lib/api/authApi';

/**
 * Foto de perfil del usuario con sesión, compartida por el sidebar y "Mi perfil"
 * (se descarga una sola vez). Sigue a la sesión: al entrar con otra cuenta la
 * vuelve a pedir y al cerrar sesión la libera.
 */
@Injectable({ providedIn: 'root' })
export class FotoPerfilService {
  private readonly auth = inject(AuthService);

  /** URL blob: de la foto, o null si no tiene (se muestran las iniciales). */
  readonly url = signal<string | null>(null);
  private cargadaPara: string | null = null;

  constructor() {
    effect(() => {
      const usuario = this.auth.usuario();
      const token = this.auth.token();
      untracked(() => this.sincronizar(usuario, token));
    });
  }

  private sincronizar(usuario: any, token: string | null): void {
    // tieneFoto === undefined: sesión guardada antes de que existiera la foto; se pregunta igual.
    if (!usuario || !token || usuario.tieneFoto === false) {
      this.cargadaPara = usuario?.id ?? null;
      this.poner(null);
      return;
    }
    if (this.cargadaPara === usuario.id && this.url()) return; // ya está la de esta cuenta
    this.cargadaPara = usuario.id;
    this.recargar();
  }

  /** Vuelve a descargarla (ej. después de cambiarla: tieneFoto sigue en true pero la imagen es otra). */
  async recargar(): Promise<void> {
    const idPedido = this.auth.usuario()?.id;
    try {
      const blob = await authApi.obtenerFoto(this.auth.token());
      if (this.auth.usuario()?.id !== idPedido) return; // cambió la sesión mientras tanto
      this.poner(blob ? URL.createObjectURL(blob) : null);
    } catch {
      // Sin foto se muestran las iniciales; no vale la pena un error en pantalla.
    }
  }

  private poner(url: string | null): void {
    const anterior = this.url();
    if (anterior && anterior !== url) URL.revokeObjectURL(anterior); // los blob: ocupan memoria hasta revocarlos
    this.url.set(url);
  }
}

/** "Natalia Herrera Gil" → "NH". */
export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return '';
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
