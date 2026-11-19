import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  imports: [DocHeader, Icon, RouterLink],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Mi perfil" />
    <main class="page">
      <!-- ---------- Cabecera del perfil ---------- -->
      <section class="ps-tarjeta mp-cabecera" aria-labelledby="mp-nombre">
        <div class="mp-avatar">
          <div class="mp-avatar__circulo">
            @if (fotoUrl()) {
              <img [src]="fotoUrl()" alt="Tu foto de perfil" />
            } @else {
              <span aria-hidden="true">{{ iniciales(nombreGuardado()) || '?' }}</span>
            }
          </div>
          <!-- El input de archivo va oculto; lo abre el botón (más fácil de estilizar y de usar con teclado). -->
          <input #inputFoto type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" tabindex="-1" aria-hidden="true" (change)="onFotoElegida($event)" />
          <button type="button" class="mp-avatar__boton" (click)="inputFoto.click()" [disabled]="procesandoFoto()" [attr.aria-label]="fotoUrl() ? 'Cambiar foto de perfil' : 'Subir foto de perfil'" title="Cambiar foto">
            <app-icon name="camara" [size]="16" [strokeWidth]="2" />
          </button>
        </div>

        <div class="mp-cabecera__texto">
          <h2 class="mp-nombre" id="mp-nombre">{{ nombreGuardado() || 'Tu perfil' }}</h2>
          <p class="mp-correo">{{ correoGuardado() }}</p>
          <div class="mp-etiquetas">
            <span class="cand-pildora cand-pildora--nueva">{{ etiquetaRol() }}</span>
            @if (miembroDesde()) {
              <span class="mp-dato"><app-icon name="calendario" [size]="13" [strokeWidth]="2" /> Miembro desde {{ miembroDesde() }}</span>
            }
            @if (cedula()) {
              <span class="mp-dato">C.C. {{ cedula() }}</span>
            }
          </div>
          <p class="mp-foto-estado" [class.mp-foto-estado--error]="errorFoto()" role="status" aria-live="polite">
            @if (procesandoFoto()) {
              Guardando foto…
            } @else if (errorFoto() || mensajeFoto()) {
              {{ errorFoto() || mensajeFoto() }}
            } @else {
              Foto en JPG, PNG o WebP.
            }
            @if (fotoUrl() && !procesandoFoto()) {
              · <button type="button" class="hr-link-btn hr-link-btn--danger" (click)="onQuitarFoto()">Quitar foto</button>
            }
          </p>
        </div>

        @if (esCandidato()) {
          <div class="mp-hoja" [class.is-completa]="perfilCompletado()">
            <span class="mp-hoja__icono" aria-hidden="true"><app-icon [name]="perfilCompletado() ? 'check' : 'documento'" [size]="18" [strokeWidth]="2" /></span>
            <div>
              <strong>{{ perfilCompletado() ? 'Hoja de vida completa' : 'Hoja de vida incompleta' }}</strong>
              <span>{{ perfilCompletado() ? 'Puedes postularte con un clic.' : 'Complétala para postularte.' }}</span>
            </div>
            <a routerLink="/completar-perfil" class="btn btn-sm" [class.btn-primary]="!perfilCompletado()" [class.btn-secondary]="perfilCompletado()">
              {{ perfilCompletado() ? 'Editar' : 'Completar' }}
            </a>
          </div>
        }
      </section>

      <!-- ---------- Datos de la cuenta ---------- -->
      <section class="ps-tarjeta mp-seccion" aria-labelledby="mp-datos">
        <div class="mp-seccion__cabecera">
          <span class="mp-seccion__icono" aria-hidden="true"><app-icon name="persona" [size]="18" [strokeWidth]="2" /></span>
          <div>
            <h3 class="mp-seccion__titulo" id="mp-datos">Datos de la cuenta</h3>
            <p class="mp-seccion__sub">Tu nombre y el correo donde recibes las notificaciones de tus postulaciones.</p>
          </div>
        </div>

        @if (errorDatos()) {
          <div class="notice notice--danger">{{ errorDatos() }}</div>
        }
        @if (okDatos()) {
          <div class="notice notice--info">Tus datos se actualizaron.</div>
        }

        <form (submit)="onGuardarDatos($event)">
          <div class="mp-campos">
            <div class="campo-auth">
              <label for="nombreCompleto">Nombre completo</label>
              <div class="campo-auth__wrap">
                <span class="campo-auth__icono"><app-icon name="user" [size]="16" [strokeWidth]="1.6" /></span>
                <input id="nombreCompleto" class="campo-auth__input" type="text" autocomplete="name" required minlength="3" [value]="nombreCompleto()" (input)="nombreCompleto.set($any($event.target).value)" />
              </div>
            </div>
            <div class="campo-auth">
              <label for="email">Correo electrónico</label>
              <div class="campo-auth__wrap">
                <span class="campo-auth__icono"><app-icon name="mail" [size]="16" [strokeWidth]="1.6" /></span>
                <input id="email" class="campo-auth__input" type="email" required autocomplete="email" spellcheck="false" [value]="email()" (input)="email.set($any($event.target).value)" />
              </div>
            </div>
          </div>
          <div class="mp-acciones">
            @if (datosCambiados()) {
              <button type="button" class="btn btn-secondary btn-sm" (click)="descartarDatos()" [disabled]="guardandoDatos()">Descartar</button>
            }
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="guardandoDatos() || !datosCambiados()">
              {{ guardandoDatos() ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </div>
        </form>
      </section>

      <!-- ---------- Contraseña ---------- -->
      <section class="ps-tarjeta mp-seccion" aria-labelledby="mp-seguridad">
        <div class="mp-seccion__cabecera mp-seccion__cabecera--fila">
          <span class="mp-seccion__icono" aria-hidden="true"><app-icon name="escudo" [size]="18" [strokeWidth]="2" /></span>
          <div style="flex: 1; min-width: 0">
            <h3 class="mp-seccion__titulo" id="mp-seguridad">Contraseña</h3>
            <p class="mp-seccion__sub">Cámbiala periódicamente para mantener tu cuenta segura.</p>
          </div>
          @if (!mostrarPassword()) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="abrirPassword()">
              <app-icon name="lock" [size]="14" [strokeWidth]="2" /> Cambiar contraseña
            </button>
          }
        </div>

        @if (okPassword() && !mostrarPassword()) {
          <div class="notice notice--info" style="margin: 16px 0 0">Tu contraseña se actualizó.</div>
        }

        @if (mostrarPassword()) {
          <form class="mp-password" (submit)="onCambiarPassword($event)">
            @if (errorPassword()) {
              <div class="notice notice--danger">{{ errorPassword() }}</div>
            }
            <div class="campo-auth">
              <label for="passwordActual">Contraseña actual</label>
              <div class="campo-auth__wrap">
                <span class="campo-auth__icono"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
                <input id="passwordActual" class="campo-auth__input campo-auth__input--con-boton" [type]="verActual() ? 'text' : 'password'" required autocomplete="current-password" [value]="passwordActual()" (input)="passwordActual.set($any($event.target).value)" />
                <button type="button" class="campo-auth__toggle" (click)="verActual.set(!verActual())" [attr.aria-label]="verActual() ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="verActual()">
                  <app-icon [name]="verActual() ? 'eyeOff' : 'eye'" [size]="17" [strokeWidth]="1.6" />
                </button>
              </div>
            </div>

            <div class="mp-campos">
              <div class="campo-auth">
                <label for="passwordNueva">Nueva contraseña</label>
                <div class="campo-auth__wrap">
                  <span class="campo-auth__icono"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
                  <input id="passwordNueva" class="campo-auth__input campo-auth__input--con-boton" [type]="verNueva() ? 'text' : 'password'" required minlength="8" autocomplete="new-password" [value]="passwordNueva()" (input)="passwordNueva.set($any($event.target).value)" />
                  <button type="button" class="campo-auth__toggle" (click)="verNueva.set(!verNueva())" [attr.aria-label]="verNueva() ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="verNueva()">
                    <app-icon [name]="verNueva() ? 'eyeOff' : 'eye'" [size]="17" [strokeWidth]="1.6" />
                  </button>
                </div>
              </div>
              <div class="campo-auth">
                <label for="passwordConfirmar">Confirmar nueva contraseña</label>
                <div class="campo-auth__wrap">
                  <span class="campo-auth__icono"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
                  <input id="passwordConfirmar" class="campo-auth__input campo-auth__input--con-boton" [type]="verConfirmar() ? 'text' : 'password'" required autocomplete="new-password" [value]="passwordConfirmar()" (input)="passwordConfirmar.set($any($event.target).value)" />
                  <button type="button" class="campo-auth__toggle" (click)="verConfirmar.set(!verConfirmar())" [attr.aria-label]="verConfirmar() ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="verConfirmar()">
                    <app-icon [name]="verConfirmar() ? 'eyeOff' : 'eye'" [size]="17" [strokeWidth]="1.6" />
                  </button>
                </div>
                @if (passwordConfirmar() && passwordConfirmar() !== passwordNueva()) {
                  <span class="mp-no-coincide">No coincide con la nueva contraseña.</span>
                }
              </div>
            </div>

            @if (passwordNueva()) {
              <div class="mp-fuerza">
                <div class="pw-strength" aria-live="polite">
                  <div class="pw-strength__bars">
                    @for (i of [0, 1, 2, 3]; track i) {
                      <span [class]="claseBarra(i)"></span>
                    }
                  </div>
                  <span class="pw-strength__label level-{{ fuerza().nivel }}">{{ fuerza().label }}</span>
                </div>
                <ul class="mp-criterios">
                  @for (c of criterios; track c.label) {
                    <li [class.is-ok]="c.test(passwordNueva())">
                      <app-icon [name]="c.test(passwordNueva()) ? 'checkMini' : 'circle'" [size]="14" [strokeWidth]="c.test(passwordNueva()) ? 2.5 : 2" />
                      {{ c.label }}
                    </li>
                  }
                </ul>
              </div>
            }

            <div class="mp-acciones">
              <button type="button" class="btn btn-secondary btn-sm" (click)="cerrarPassword()" [disabled]="guardandoPassword()">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="guardandoPassword()">
                <app-icon name="lockBadge" [size]="14" [strokeWidth]="2" /> {{ guardandoPassword() ? 'Cambiando…' : 'Guardar contraseña' }}
              </button>
            </div>
          </form>
        }
      </section>

      <!-- ---------- Desactivar / eliminar cuenta ---------- -->
      <section class="mp-riesgo" aria-labelledby="mp-baja">
        <div style="flex: 1; min-width: 0">
          <h3 class="mp-riesgo__titulo" id="mp-baja">{{ esAdmin() ? 'Eliminar cuenta' : 'Desactivar cuenta' }}</h3>
          <p class="mp-riesgo__texto">
            @if (esAdmin()) {
              Se borran de forma permanente tus datos. Esta acción no se puede deshacer.
            } @else {
              No podrás iniciar sesión ni postularte hasta que Gestión Humana la reactive. Tus postulaciones se conservan.
            }
          </p>
          @if (errorBaja()) {
            <div class="notice notice--danger" style="margin: 10px 0 0">{{ errorBaja() }}</div>
          }
        </div>
        <button type="button" class="btn btn-danger-outline btn-sm" (click)="esAdmin() ? onEliminarCuenta() : onDesactivarCuenta()" [disabled]="procesandoBaja()">
          <app-icon name="papelera" [size]="14" [strokeWidth]="2" />
          {{ textoBotonBaja() }}
        </button>
      </section>
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

  // ---- Cabecera ----
  protected readonly perfilCompletado = this.auth.perfilCompletado;
  protected readonly mostrarPassword = signal(false);

  protected nombreGuardado(): string {
    return this.auth.usuario()?.nombreCompleto || '';
  }

  protected correoGuardado(): string {
    return this.auth.usuario()?.email || '';
  }

  protected cedula(): string {
    return this.auth.usuario()?.cedula || '';
  }

  protected esCandidato(): boolean {
    return this.auth.usuario()?.rol === 'candidato';
  }

  protected etiquetaRol(): string {
    const rol = this.auth.usuario()?.rol;
    return rol === 'admin' ? 'Administrador' : rol === 'gestor_humano' ? 'Gestión Humana' : 'Candidato';
  }

  protected miembroDesde(): string {
    const f = this.auth.usuario()?.fechaCreacion;
    if (!f) return '';
    const d = new Date(f);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  }

  protected datosCambiados(): boolean {
    return this.nombreCompleto().trim() !== this.nombreGuardado() || this.email().trim() !== this.correoGuardado();
  }

  protected descartarDatos(): void {
    this.nombreCompleto.set(this.nombreGuardado());
    this.email.set(this.correoGuardado());
    this.errorDatos.set('');
  }

  protected abrirPassword(): void {
    this.okPassword.set(false);
    this.errorPassword.set('');
    this.mostrarPassword.set(true);
  }

  protected cerrarPassword(): void {
    this.passwordActual.set('');
    this.passwordNueva.set('');
    this.passwordConfirmar.set('');
    this.errorPassword.set('');
    this.mostrarPassword.set(false);
  }

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
      this.mostrarPassword.set(false);
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
