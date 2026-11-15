import { Component, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as authApi from '../lib/api/authApi';
import { ApiError } from '../lib/api/httpClient';
import { Icon } from '../shared/icon';
import { Autofocus } from '../shared/autofocus';
import { authStyles } from './auth/auth-styles';

@Component({
  selector: 'app-olvide-password-page',
  imports: [NgStyle, RouterLink, Icon, Autofocus],
  host: { style: 'display: contents' },
  template: `
    <main class="auth-split">
      <div class="auth-split__form" style="flex: 1 1 100%">
        <div class="auth-split__form-inner">
          <div [ngStyle]="s.logoArea">
            <img src="assets/logo-aguas-nacionales.png" alt="Aguas Nacionales EPM" [ngStyle]="s.logoImg" />
            <p [ngStyle]="s.brandTagline">Plataforma de Selección de Personal</p>
          </div>
          <div [ngStyle]="s.divider"></div>

          <div [ngStyle]="s.illustrationCircle">
            <app-icon name="mail" [size]="34" [strokeWidth]="1.6" />
            <span [ngStyle]="s.illustrationBadge"><app-icon name="lockBadge" [size]="14" [strokeWidth]="2" /></span>
          </div>

          <h1 [ngStyle]="m(s.heading, { textAlign: 'center' })">¿Olvidaste tu contraseña?</h1>
          <p [ngStyle]="m(s.subheading, { textAlign: 'center' })">
            No te preocupes, te ayudamos a recuperarla. Ingresa tu correo electrónico y te enviaremos las
            instrucciones para restablecer tu contraseña.
          </p>

          @if (error()) {
            <div [ngStyle]="s.error" role="alert">{{ error() }}</div>
          }

          @if (enviado()) {
            <div [ngStyle]="s.success" role="status">
              Si el correo está registrado, en breve recibirás un enlace para restablecer tu contraseña.
              @if (enlaceDev()) {
                <div style="margin-top: 10px">
                  <div style="font-size: 11px; opacity: 0.8; margin-bottom: 4px">(Solo en desarrollo — todavía no hay envío de correo real)</div>
                  <a [href]="enlaceDev()" style="color: #004d20; font-weight: 700; word-break: break-all">{{ enlaceDev() }}</a>
                </div>
              }
            </div>
            <div [ngStyle]="s.tipBox">
              <app-icon name="shield" [size]="15" [strokeWidth]="1.7" />
              <span>Si no recibes el correo en los próximos minutos, revisa tu bandeja de spam o correo no deseado.</span>
            </div>
          } @else {
            <div [ngStyle]="s.field">
              <label for="olvide-email" [ngStyle]="s.label">Correo electrónico</label>
              <div [ngStyle]="s.inputWrap">
                <span [ngStyle]="s.inputIcon"><app-icon name="mail" [size]="16" [strokeWidth]="1.6" /></span>
                <input
                  appAutofocus
                  id="olvide-email"
                  autocomplete="email"
                  spellcheck="false"
                  [ngStyle]="m(s.input, focused() ? s.inputFocus : null)"
                  type="email"
                  placeholder="Ingresa tu correo electrónico"
                  [value]="email()"
                  (input)="email.set($any($event.target).value)"
                  (focus)="focused.set(true)"
                  (blur)="focused.set(false)"
                  (keydown)="onKeyDown($event)"
                />
              </div>
            </div>

            <button
              [ngStyle]="m(s.button, btnHover() && !cargando() ? s.buttonHover : null, cargando() ? s.buttonDisabled : null)"
              (click)="handleEnviar()"
              (mouseenter)="btnHover.set(true)"
              (mouseleave)="btnHover.set(false)"
              [disabled]="cargando()"
            >
              {{ cargando() ? 'Enviando…' : 'Enviar instrucciones' }}
            </button>

            <div [ngStyle]="s.tipBox">
              <app-icon name="shield" [size]="15" [strokeWidth]="1.7" />
              <span>Si no recibes el correo en los próximos minutos, revisa tu bandeja de spam o correo no deseado.</span>
            </div>
          }

          <p [ngStyle]="m(s.switchLink, { marginTop: '22px' })">
            <a routerLink="/login" [ngStyle]="m(s.forgotLink, { display: 'inline-flex', alignItems: 'center', gap: '6px' })">
              <app-icon name="arrowLeft" [size]="15" [strokeWidth]="2" /> Volver al inicio de sesión
            </a>
          </p>

          <p [ngStyle]="s.footer">© {{ anio }} Aguas Nacionales EPM S.A. E.S.P.</p>
        </div>
      </div>
    </main>
  `,
})
export class OlvidePasswordPage {
  protected readonly s = authStyles;
  protected readonly anio = new Date().getFullYear();
  protected readonly email = signal('');
  protected readonly error = signal('');
  protected readonly enviado = signal(false);
  protected readonly enlaceDev = signal<string | null>(null);
  protected readonly cargando = signal(false);
  protected readonly focused = signal(false);
  protected readonly btnHover = signal(false);

  protected m(...estilos: any[]): Record<string, any> {
    return Object.assign({}, ...estilos.filter(Boolean));
  }

  protected async handleEnviar(): Promise<void> {
    if (!this.email().trim()) {
      this.error.set('Ingresa tu correo electrónico.');
      return;
    }
    this.error.set('');
    this.cargando.set(true);
    try {
      const resp = await authApi.olvidePassword(this.email().trim());
      this.enviado.set(true);
      if (resp.token_dev) {
        this.enlaceDev.set(`${window.location.origin}/restablecer-password?token=${resp.token_dev}`);
      }
    } catch (err: any) {
      this.error.set(err instanceof ApiError ? err.detail : 'No se pudo procesar la solicitud.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.handleEnviar();
  }
}
