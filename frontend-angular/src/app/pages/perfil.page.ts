import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DocHeader } from '../components/doc-header';
import { Icon } from '../shared/icon';
import { AuthService } from '../core/auth.service';
import { FotoPerfilService, iniciales } from '../core/foto-perfil.service';
import * as authApi from '../lib/api/authApi';
import { ApiError } from '../lib/api/httpClient';


function calcularFuerza(password: string): { score: number; label: string; nivel: string } {
  if (!password) return { score: 0, label: '', nivel: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const etiquetas = ['Muy débil', 'Débil', 'Regular', 'Fuerte'];
  const niveles = ['weak', 'weak', 'medium', 'strong'];
  const idx = Math.max(0, score - 1);
  return { score, label: password.length ? etiquetas[idx] : '', nivel: niveles[idx] };
}

const CRITERIOS_PASSWORD = [
  { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Una mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Una minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Un número', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Un carácter especial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

// La foto se reduce en el navegador antes de subirla: las fotos de celular pesan
// varios MB y el avatar se muestra a 110 px. 512 px alcanza de sobra.
const FOTO_LADO_MAX = 512;
const FOTO_ARCHIVO_MAX = 15 * 1024 * 1024; // lo que se acepta del disco antes de reducir
const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

/** Reduce la imagen a FOTO_LADO_MAX y la devuelve como JPEG en base64 (sin el prefijo data:). */
async function reducirFoto(archivo: File): Promise<string> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, FOTO_LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // fondo blanco para PNG/WebP con transparencia (JPEG no tiene alfa)
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  return dataUrl.split(',')[1];
}


@Component({
  selector: 'app-perfil-page',
  imports: [DocHeader, Icon],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Mi perfil" [showCode]="false" />
    <main class="page">
      <p class="section-intro" style="margin-top: -8px">Administra tu información personal y la seguridad de tu cuenta.</p>

      <!-- ---------- Información personal ---------- -->
      <div class="section-card">
        <div class="section-card__header">
          <span class="section-card__icon"><app-icon name="persona" [size]="18" [strokeWidth]="2" /></span>
          <div>
            <h2 class="section-card__title">Información personal</h2>
            <p class="section-card__subtitle">Actualiza tus datos personales y de contacto.</p>
          </div>
        </div>

        @if (errorDatos()) {
          <div class="notice notice--danger">{{ errorDatos() }}</div>
        }
        @if (okDatos()) {
          <div class="notice notice--info">Perfil actualizado.</div>
        }

        <form (submit)="onGuardarDatos($event)">
          <div class="profile-info-layout">
            <div class="profile-info-layout__avatar">
              <div class="avatar-upload">
                <div class="avatar-circle">
                  @if (fotoUrl()) {
                    <img class="avatar-circle__img" [src]="fotoUrl()" alt="Tu foto de perfil" />
                  } @else {
                    <span aria-hidden="true">{{ iniciales(nombreCompleto()) || '?' }}</span>
                  }
                </div>
                <!-- El input de archivo va oculto; lo abre el botón (más fácil de estilizar y de usar con teclado). -->
                <input
                  #inputFoto
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="sr-only"
                  tabindex="-1"
                  aria-hidden="true"
                  (change)="onFotoElegida($event)"
                />
                <button type="button" class="btn btn-secondary btn-sm" (click)="inputFoto.click()" [disabled]="procesandoFoto()">
                  <app-icon name="camara" [size]="14" [strokeWidth]="2" />
                  {{ procesandoFoto() ? 'Guardando…' : fotoUrl() ? 'Cambiar foto' : 'Subir foto' }}
                </button>
                @if (fotoUrl() && !procesandoFoto()) {
                  <button type="button" class="hr-link-btn hr-link-btn--danger" (click)="onQuitarFoto()">Quitar foto</button>
                }
                <p
                  class="avatar-upload__estado"
                  [class.avatar-upload__estado--error]="errorFoto()"
                  role="status"
                  aria-live="polite"
                >{{ errorFoto() || mensajeFoto() || 'JPG, PNG o WebP.' }}</p>
              </div>
            </div>

            <div class="profile-info-layout__fields">
              <div class="campo-auth">
                <label for="nombreCompleto">Nombre completo</label>
                <div class="campo-auth__wrap">
                  <span class="campo-auth__icono"><app-icon name="user" [size]="16" [strokeWidth]="1.6" /></span>
                  <input
                    id="nombreCompleto"
                    class="campo-auth__input"
                    type="text"
                    autocomplete="name"
                    required
                    minlength="3"
                    [value]="nombreCompleto()"
                    (input)="nombreCompleto.set($any($event.target).value)"
                  />
                </div>
              </div>
              <div class="campo-auth">
                <label for="email">Correo electrónico</label>
                <div class="campo-auth__wrap">
                  <span class="campo-auth__icono"><app-icon name="mail" [size]="16" [strokeWidth]="1.6" /></span>
                  <input
                    id="email"
                    class="campo-auth__input"
                    type="email"
                    required
                    autocomplete="email"
                    spellcheck="false"
                    [value]="email()"
                    (input)="email.set($any($event.target).value)"
                  />
                </div>
              </div>

              <div class="notice notice--info">
                Este correo se utiliza para notificaciones y comunicaciones relacionadas con tus postulaciones.
              </div>

              <div style="display: flex; justify-content: flex-end; margin-top: 20px">
                <button type="submit" class="btn btn-primary" [disabled]="guardandoDatos()">
                  {{ guardandoDatos() ? 'Guardando…' : 'Guardar cambios' }}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- ---------- Seguridad de la cuenta ---------- -->
      <div class="section-card mt-24">
        <div class="section-card__header">
          <span class="section-card__icon"><app-icon name="escudo" [size]="18" [strokeWidth]="2" /></span>
          <div>
            <h2 class="section-card__title">Seguridad de la cuenta</h2>
            <p class="section-card__subtitle">Cambia tu contraseña periódicamente para mantener tu cuenta segura.</p>
          </div>
        </div>

        @if (errorPassword()) {
          <div class="notice notice--danger">{{ errorPassword() }}</div>
        }
        @if (okPassword()) {
          <div class="notice notice--info">Contraseña actualizada.</div>
        }

        <form (submit)="onCambiarPassword($event)">
          <div class="campo-auth">
            <label for="passwordActual">Contraseña actual</label>
            <div class="campo-auth__wrap">
              <span class="campo-auth__icono"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                id="passwordActual"
                class="campo-auth__input campo-auth__input--con-boton"
                [type]="verActual() ? 'text' : 'password'"
                required
                autocomplete="current-password"
                [value]="passwordActual()"
                (input)="passwordActual.set($any($event.target).value)"
              />
              <button
                type="button"
                class="campo-auth__toggle"
                (click)="verActual.set(!verActual())"
                [attr.aria-label]="verActual() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                [attr.aria-pressed]="verActual()"
              >
                <app-icon [name]="verActual() ? 'eyeOff' : 'eye'" [size]="17" [strokeWidth]="1.6" />
              </button>
            </div>
          </div>

          <div class="campo-auth" [style.margin-bottom.px]="passwordNueva() ? 6 : 18">
            <label for="passwordNueva">Nueva contraseña</label>
            <div class="campo-auth__wrap">
              <span class="campo-auth__icono"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                id="passwordNueva"
                class="campo-auth__input campo-auth__input--con-boton"
                [type]="verNueva() ? 'text' : 'password'"
                required
                minlength="8"
                autocomplete="new-password"
                [value]="passwordNueva()"
                (input)="passwordNueva.set($any($event.target).value)"
              />
              <button
                type="button"
                class="campo-auth__toggle"
                (click)="verNueva.set(!verNueva())"
                [attr.aria-label]="verNueva() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                [attr.aria-pressed]="verNueva()"
              >
                <app-icon [name]="verNueva() ? 'eyeOff' : 'eye'" [size]="17" [strokeWidth]="1.6" />
              </button>
            </div>
          </div>

          @if (passwordNueva()) {
            <div class="pw-strength" aria-live="polite">
              <div class="pw-strength__bars">
                @for (i of [0, 1, 2, 3]; track i) {
                  <span [class]="claseBarra(i)"></span>
                }
              </div>
              <span class="pw-strength__label level-{{ fuerza().nivel }}">{{ fuerza().label }}</span>
            </div>
          }

          @if (passwordNueva()) {
            <div style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; row-gap: 6px; margin: 10px 0 20px">
              @for (c of criterios; track c.label) {
                <div
                  style="display: flex; align-items: center; gap: 6px; font-size: 13px"
                  [style.color]="c.test(passwordNueva()) ? 'var(--color-primary)' : 'var(--color-text-muted)'"
                >
                  @if (c.test(passwordNueva())) {
                    <app-icon name="checkMini" [size]="14" [strokeWidth]="2.5" />
                  } @else {
                    <app-icon name="circle" [size]="14" [strokeWidth]="2" />
                  }
                  {{ c.label }}
                </div>
              }
            </div>
          }

          <div class="campo-auth">
            <label for="passwordConfirmar">Confirmar nueva contraseña</label>
            <div class="campo-auth__wrap">
              <span class="campo-auth__icono"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                id="passwordConfirmar"
                class="campo-auth__input campo-auth__input--con-boton"
                [type]="verConfirmar() ? 'text' : 'password'"
                required
                autocomplete="new-password"
                [value]="passwordConfirmar()"
                (input)="passwordConfirmar.set($any($event.target).value)"
              />
              <button
                type="button"
                class="campo-auth__toggle"
                (click)="verConfirmar.set(!verConfirmar())"
                [attr.aria-label]="verConfirmar() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                [attr.aria-pressed]="verConfirmar()"
              >
                <app-icon [name]="verConfirmar() ? 'eyeOff' : 'eye'" [size]="17" [strokeWidth]="1.6" />
              </button>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 6px">
            <button type="submit" class="btn btn-primary" [disabled]="guardandoPassword()">
              <app-icon name="lockBadge" [size]="14" [strokeWidth]="2" /> {{ guardandoPassword() ? 'Cambiando…' : 'Cambiar contraseña' }}
            </button>
          </div>
        </form>
      </div>

      <!-- ---------- Eliminar / desactivar cuenta ---------- -->
      <div class="section-card section-card--danger mt-24">
        <div class="section-card__header">
          <span class="section-card__icon section-card__icon--danger"><app-icon name="cuentaX" [size]="18" [strokeWidth]="2" /></span>
          <div>
            <h2 class="section-card__title section-card__title--danger">{{ esAdmin() ? 'Eliminar cuenta' : 'Desactivar cuenta' }}</h2>
            <p class="section-card__subtitle">
              {{ esAdmin() ? 'Esta acción es permanente y no se puede deshacer.' : 'Podrás solicitar que la reactiven más adelante.' }}
            </p>
          </div>
        </div>

        <p class="text-muted" style="font-size: 13px">
          @if (esAdmin()) {
            Al eliminar tu cuenta, se borrarán de forma permanente todos tus datos y postulaciones. Tus postulaciones no se borran automáticamente junto con la cuenta. Elimínalas primero desde "Mis postulaciones" si también quieres borrarlas.
          } @else {
            Al desactivar tu cuenta, no podrás iniciar sesión ni postularte a nuevas vacantes hasta que Gestión Humana la reactive. Tus postulaciones actuales se conservan.
          }
        </p>

        @if (errorBaja()) {
          <div class="notice notice--danger">{{ errorBaja() }}</div>
        }

        <div style="display: flex; justify-content: flex-end">
          <button
            type="button"
            class="btn btn-danger-outline"
            (click)="esAdmin() ? onEliminarCuenta() : onDesactivarCuenta()"
            [disabled]="procesandoBaja()"
          >
            <app-icon name="papelera" [size]="14" [strokeWidth]="2" />
            {{ textoBotonBaja() }}
          </button>
        </div>
      </div>
    </main>
  `,
})
export class PerfilPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly iniciales = iniciales;
  protected readonly criterios = CRITERIOS_PASSWORD;

  // ---- Foto de perfil (la misma que muestra el sidebar) ----
  private readonly foto = inject(FotoPerfilService);
  protected readonly fotoUrl = this.foto.url;
  protected readonly procesandoFoto = signal(false);
  protected readonly errorFoto = signal('');
  protected readonly mensajeFoto = signal('');

  protected async onFotoElegida(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    this.errorFoto.set('');
    this.mensajeFoto.set('');
    if (!FOTO_TIPOS.includes(archivo.type)) {
      this.errorFoto.set('Elige una imagen JPG, PNG o WebP.');
      return;
    }
    if (archivo.size > FOTO_ARCHIVO_MAX) {
      this.errorFoto.set('La imagen es demasiado grande (máximo 15 MB).');
      return;
    }

    this.procesandoFoto.set(true);
    try {
      const base64 = await reducirFoto(archivo);
      const actualizado = await authApi.subirFoto(base64, 'image/jpeg', this.auth.token());
      this.auth.actualizarUsuarioLocal(actualizado);
      await this.foto.recargar(); // tieneFoto puede seguir en true: la imagen nueva hay que pedirla
      this.mensajeFoto.set('Foto actualizada.');
    } catch (err: any) {
      this.errorFoto.set(err instanceof ApiError ? err.detail : 'No se pudo leer la imagen. Intenta con otra.');
    } finally {
      this.procesandoFoto.set(false);
    }
  }

  protected async onQuitarFoto(): Promise<void> {
    this.errorFoto.set('');
    this.mensajeFoto.set('');
    this.procesandoFoto.set(true);
    try {
      const actualizado = await authApi.eliminarFoto(this.auth.token());
      this.auth.actualizarUsuarioLocal(actualizado); // tieneFoto: false → el servicio la quita
      this.mensajeFoto.set('Foto eliminada.');
    } catch (err: any) {
      this.errorFoto.set(err instanceof ApiError ? err.detail : 'No se pudo quitar la foto.');
    } finally {
      this.procesandoFoto.set(false);
    }
  }

  // ---- Datos personales ----
  protected readonly nombreCompleto = signal<string>(this.auth.usuario()?.nombreCompleto || '');
  protected readonly email = signal<string>(this.auth.usuario()?.email || '');
  protected readonly errorDatos = signal('');
  protected readonly okDatos = signal(false);
  protected readonly guardandoDatos = signal(false);

  // ---- Cambiar contraseña ----
  protected readonly passwordActual = signal('');
  protected readonly passwordNueva = signal('');
  protected readonly passwordConfirmar = signal('');
  protected readonly verActual = signal(false);
  protected readonly verNueva = signal(false);
  protected readonly verConfirmar = signal(false);
  protected readonly errorPassword = signal('');
  protected readonly okPassword = signal(false);
  protected readonly guardandoPassword = signal(false);

  // ---- Eliminar / desactivar cuenta ----
  protected readonly errorBaja = signal('');
  protected readonly procesandoBaja = signal(false);

  protected esAdmin(): boolean {
    return this.auth.usuario()?.rol === 'admin';
  }

  protected fuerza() {
    return calcularFuerza(this.passwordNueva());
  }

  protected claseBarra(i: number): string {
    const f = this.fuerza();
    return `pw-strength__bar${i < f.score ? ` is-filled level-${f.nivel}` : ''}`;
  }

  protected textoBotonBaja(): string {
    const esAdmin = this.esAdmin();
    if (this.procesandoBaja()) return esAdmin ? 'Eliminando…' : 'Desactivando…';
    return esAdmin ? 'Eliminar mi cuenta' : 'Desactivar mi cuenta';
  }

  protected async onGuardarDatos(e: Event): Promise<void> {
    e.preventDefault();
    this.errorDatos.set('');
    this.okDatos.set(false);
    this.guardandoDatos.set(true);
    try {
      const actualizado = await authApi.actualizarPerfil({ nombreCompleto: this.nombreCompleto(), email: this.email() }, this.auth.token());
      this.auth.actualizarUsuarioLocal(actualizado);
      this.okDatos.set(true);
    } catch (err: any) {
      this.errorDatos.set(err instanceof ApiError ? err.detail : 'No se pudo actualizar el perfil.');
    } finally {
      this.guardandoDatos.set(false);
    }
  }

  protected async onCambiarPassword(e: Event): Promise<void> {
    e.preventDefault();
    this.errorPassword.set('');
    this.okPassword.set(false);

    if (this.passwordNueva() !== this.passwordConfirmar()) {
      this.errorPassword.set('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    this.guardandoPassword.set(true);
    try {
      await authApi.cambiarPassword(this.passwordActual(), this.passwordNueva(), this.auth.token());
      this.passwordActual.set('');
      this.passwordNueva.set('');
      this.passwordConfirmar.set('');
      this.okPassword.set(true);
    } catch (err: any) {
      this.errorPassword.set(err instanceof ApiError ? err.detail : 'No se pudo cambiar la contraseña.');
    } finally {
      this.guardandoPassword.set(false);
    }
  }

  protected async onEliminarCuenta(): Promise<void> {
    if (!window.confirm('¿Eliminar tu cuenta por completo? Esta acción no se puede deshacer.')) return;
    this.errorBaja.set('');
    this.procesandoBaja.set(true);
    try {
      await authApi.eliminarCuenta(this.auth.token());
      this.auth.logout();
      this.router.navigate(['/'], { replaceUrl: true });
    } catch (err: any) {
      this.errorBaja.set(err instanceof ApiError ? err.detail : 'No se pudo eliminar la cuenta.');
    } finally {
      this.procesandoBaja.set(false);
    }
  }

  protected async onDesactivarCuenta(): Promise<void> {
    if (!window.confirm('¿Desactivar tu cuenta? No podrás iniciar sesión hasta que la reactiven.')) return;
    this.errorBaja.set('');
    this.procesandoBaja.set(true);
    try {
      await authApi.desactivarCuenta(this.auth.token());
      this.auth.logout();
      this.router.navigate(['/'], { replaceUrl: true });
    } catch (err: any) {
      this.errorBaja.set(err instanceof ApiError ? err.detail : 'No se pudo desactivar la cuenta.');
    } finally {
      this.procesandoBaja.set(false);
    }
  }
}
