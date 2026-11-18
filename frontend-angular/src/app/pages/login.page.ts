import { Component, inject, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiError } from '../lib/api/httpClient';
import { Icon } from '../shared/icon';
import { Autofocus } from '../shared/autofocus';
import { authStyles } from './auth/auth-styles';

@Component({
  selector: 'app-login-page',
  imports: [NgStyle, FormsModule, RouterLink, Icon, Autofocus],
  host: { style: 'display: contents' },
  template: `
    <main class="auth-split">
      <!-- Columna derecha — formulario -->
      <div class="auth-split__form">
        <div class="auth-split__form-inner">
          <div class="auth-split__mobile-logo">
            <img src="assets/logo-aguas-nacionales.png" alt="Aguas Nacionales EPM" />
            <p [ngStyle]="s.brandTagline">Plataforma de Selección de Personal</p>
          </div>

          <h1 [ngStyle]="s.heading">Bienvenido</h1>
          <p [ngStyle]="s.subheading">Accede para ver las convocatorias abiertas y gestionar tus postulaciones.</p>

          @if (error()) {
            <div id="login-error" [ngStyle]="s.error" role="alert">{{ error() }}</div>
          }
          @if (auth.sesionExpirada()) {
            <div [ngStyle]="s.success" role="status">Tu sesión expiró. Vuelve a iniciar sesión para continuar donde ibas.</div>
          }
          @if (cuentaCreada) {
            <div [ngStyle]="s.success" role="status">Tu cuenta se creó correctamente. Inicia sesión para continuar.</div>
          }
          @if (restablecida) {
            <div [ngStyle]="s.success" role="status">Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.</div>
          }

          <form (ngSubmit)="handleLogin()">
          <div [ngStyle]="s.field">
            <label for="login-email" [ngStyle]="s.label">Correo electrónico</label>
            <div [ngStyle]="s.inputWrap">
              <span [ngStyle]="s.inputIcon"><app-icon name="mail" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                appAutofocus
                id="login-email"
                name="email"
                spellcheck="false"
                [ngStyle]="m(s.input, focused() === 'email' ? s.inputFocus : null)"
                type="email"
                placeholder="tu.correo@ejemplo.com"
                [value]="email()"
                (input)="email.set($any($event.target).value)"
                (focus)="focused.set('email')"
                (blur)="focused.set(null)"
                autocomplete="username"
                [attr.aria-describedby]="error() ? 'login-error' : null"
              />
            </div>
          </div>

          <div [ngStyle]="s.field">
            <label for="login-password" [ngStyle]="s.label">Contraseña</label>
            <div [ngStyle]="s.inputWrap">
              <span [ngStyle]="s.inputIcon"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                id="login-password"
                name="password"
                [ngStyle]="m(s.input, { paddingRight: '44px' }, focused() === 'password' ? s.inputFocus : null)"
                [type]="mostrarPassword() ? 'text' : 'password'"
                placeholder="Tu contraseña"
                [value]="password()"
                (input)="password.set($any($event.target).value)"
                (focus)="focused.set('password')"
                (blur)="focused.set(null)"
                autocomplete="current-password"
                [attr.aria-describedby]="error() ? 'login-error' : null"
              />
              <button
                type="button"
                [ngStyle]="s.inputToggle"
                (click)="mostrarPassword.set(!mostrarPassword())"
                [attr.aria-label]="mostrarPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                [attr.aria-pressed]="mostrarPassword()"
              >
                <app-icon [name]="mostrarPassword() ? 'eyeOff' : 'eye'" [size]="17" [strokeWidth]="1.6" />
              </button>
            </div>
          </div>

          <div [ngStyle]="s.optionsRow">
            <label [ngStyle]="s.checkboxLabel">
              <input type="checkbox" [ngStyle]="s.checkbox" [checked]="recordar()" (change)="recordar.set($any($event.target).checked)" />
              Recordarme
            </label>
            <a routerLink="/olvide-password" [ngStyle]="s.forgotLink">¿Olvidaste tu contraseña?</a>
          </div>

          <button
            type="submit"
            class="auth-btn"
            [disabled]="cargando()"
          >
            @if (cargando()) {
              <span class="auth-btn__spinner" aria-hidden="true"></span>
            }
            {{ cargando() ? 'Ingresando…' : 'Iniciar sesión' }}
            @if (!cargando()) {
              <app-icon name="arrow" [size]="17" [strokeWidth]="2" />
            }
          </button>
          </form>

          <div [ngStyle]="s.dividerOr">
            <span [ngStyle]="s.dividerOrLine"></span>
            o
            <span [ngStyle]="s.dividerOrLine"></span>
          </div>

          <a
            routerLink="/registro"
            class="auth-btn-secondary"
          >
            <app-icon name="user" [size]="16" [strokeWidth]="1.6" /> Crear cuenta
          </a>

          <p [ngStyle]="s.footer">Aguas Nacionales EPM · Gestión Humana</p>
        </div>
      </div>

      <!-- Columna izquierda — foto PROVISIONAL de la web de la empresa, a la espera de la que defina el área de Diseño.
           Va después del formulario en el DOM para que su <h2> no quede antes del <h1>; "order: -1" la mantiene a la izquierda. -->
      <div class="auth-split__photo" style="order: -1">
        <img src="assets/login-foto-provisional.jpg" alt="Instalaciones de Aguas Nacionales EPM" />
        <div class="auth-split__photo-overlay"></div>
        <div class="auth-split__photo-logo">
          <img src="assets/logo-aguas-nacionales.png" alt="Aguas Nacionales EPM" />
        </div>
        <div class="auth-split__photo-caption">
          <h2>Transformamos vidas y entornos para un futuro sostenible</h2>
          <p>En Aguas Nacionales EPM creemos en el talento que inspira, que transforma y que construye un mejor país.</p>
        </div>
        <span class="auth-split__photo-tag">Foto provisional</span>
      </div>
    </main>
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly s = authStyles;

  protected readonly cuentaCreada = !!history.state?.cuentaCreada;
  protected readonly email = signal<string>(history.state?.email || '');
  protected readonly password = signal('');
  protected readonly recordar = signal(false);
  protected readonly mostrarPassword = signal(false);
  protected readonly error = signal('');
  protected readonly restablecida = !!history.state?.restablecida;
  private readonly from = history.state?.from;
  protected readonly cargando = signal(false);
  protected readonly focused = signal<string | null>(null);

  /** Combina varios objetos de estilo (igual que {...a, ...b} en React). */
  protected m(...estilos: any[]): Record<string, any> {
    return Object.assign({}, ...estilos.filter(Boolean));
  }

  protected async handleLogin(): Promise<void> {
    if (!this.email().trim() || !this.password().trim()) {
      this.error.set('Por favor ingresa tu correo y contraseña.');
      return;
    }
    this.error.set('');
    this.cargando.set(true);
    try {
      await this.auth.login(this.email().trim(), this.password(), this.recordar());
      const destino = this.from?.pathname || '/';
      this.router.navigateByUrl(destino, { replaceUrl: true });
    } catch (err: any) {
      this.error.set(err instanceof ApiError ? err.detail : 'No se pudo conectar con el servidor.');
    } finally {
      this.cargando.set(false);
    }
  }
}
