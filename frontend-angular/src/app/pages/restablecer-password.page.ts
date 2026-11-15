import { Component, inject, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import * as authApi from '../lib/api/authApi';
import { ApiError } from '../lib/api/httpClient';
import { Icon } from '../shared/icon';
import { Autofocus } from '../shared/autofocus';
import { authStyles } from './auth/auth-styles';

@Component({
  selector: 'app-restablecer-password-page',
  imports: [NgStyle, RouterLink, Icon, Autofocus],
  host: { style: 'display: contents' },
  template: `
    <main [ngStyle]="s.page">
      <div [ngStyle]="s.card">
        <div [ngStyle]="s.logoArea">
          <img src="assets/logo-aguas-nacionales.png" alt="Aguas Nacionales EPM" [ngStyle]="s.logoImg" />
          <p [ngStyle]="s.brandTagline">Plataforma de Selección de Personal</p>
        </div>
        <div [ngStyle]="s.divider"></div>

        <h1 [ngStyle]="s.heading">Crear nueva contraseña</h1>
        <p [ngStyle]="s.subheading">Elige una contraseña nueva para tu cuenta.</p>

        @if (!token) {
          <div [ngStyle]="s.error" role="alert">Este enlace no es válido. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".</div>
        }
        @if (error()) {
          <div [ngStyle]="s.error" role="alert">{{ error() }}</div>
        }

        @if (token) {
          <div [ngStyle]="m(s.field, { marginBottom: '22px' })">
            <label for="restablecer-password" [ngStyle]="s.label">Nueva contraseña</label>
            <div [ngStyle]="s.inputWrap">
              <span [ngStyle]="s.inputIcon"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                appAutofocus
                id="restablecer-password"
                autocomplete="new-password"
                [ngStyle]="m(s.input, { paddingRight: '44px' }, focused() ? s.inputFocus : null)"
                [type]="mostrarPassword() ? 'text' : 'password'"
                placeholder="Mínimo 8 caracteres, con un número"
                [value]="passwordNueva()"
                (input)="passwordNueva.set($any($event.target).value)"
                (focus)="focused.set(true)"
                (blur)="focused.set(false)"
                (keydown)="onKeyDown($event)"
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

          <button
            [ngStyle]="m(s.button, btnHover() && !cargando() ? s.buttonHover : null, cargando() ? s.buttonDisabled : null)"
            (click)="handleRestablecer()"
            (mouseenter)="btnHover.set(true)"
            (mouseleave)="btnHover.set(false)"
            [disabled]="cargando()"
          >
            {{ cargando() ? 'Guardando…' : 'Restablecer contraseña' }}
            @if (!cargando()) {
              <app-icon name="arrow" [size]="17" [strokeWidth]="2" />
            }
          </button>
        }

        <p [ngStyle]="s.switchLink">
          <a routerLink="/login" style="color: #0a7a30; font-weight: 600">Volver a iniciar sesión</a>
        </p>

        <p [ngStyle]="s.footer">Aguas Nacionales EPM · Gestión Humana</p>
      </div>
    </main>
  `,
})
export class RestablecerPasswordPage {
  private readonly router = inject(Router);
  protected readonly s = authStyles;
  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') || '';
  protected readonly passwordNueva = signal('');
  protected readonly mostrarPassword = signal(false);
  protected readonly error = signal('');
  protected readonly cargando = signal(false);
  protected readonly focused = signal(false);
  protected readonly btnHover = signal(false);

  protected m(...estilos: any[]): Record<string, any> {
    return Object.assign({}, ...estilos.filter(Boolean));
  }

  protected async handleRestablecer(): Promise<void> {
    if (!this.passwordNueva().trim()) {
      this.error.set('Ingresa tu nueva contraseña.');
      return;
    }
    this.error.set('');
    this.cargando.set(true);
    try {
      await authApi.restablecerPassword(this.token, this.passwordNueva());
      this.router.navigate(['/login'], { replaceUrl: true, state: { restablecida: true } });
    } catch (err: any) {
      this.error.set(err instanceof ApiError ? err.detail : 'No se pudo restablecer la contraseña.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.handleRestablecer();
  }
}
