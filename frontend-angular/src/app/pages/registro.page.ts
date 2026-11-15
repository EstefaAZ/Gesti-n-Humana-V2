import { Component, inject, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ApiError } from '../lib/api/httpClient';
import { Icon } from '../shared/icon';
import { Autofocus } from '../shared/autofocus';
import { authStyles } from './auth/auth-styles';

// Reglas reales de documentos de identidad en Colombia (fuentes: Registraduría
// Nacional y Migración Colombia). No se incluye "Tarjeta de identidad" porque
// es un documento de menores de edad — no aplica a un proceso de selección laboral.
const TIPOS_DOCUMENTO = [
  { valor: 'Cédula de ciudadanía', formato: 'numerico', min: 6, max: 10, ayuda: 'Solo números, entre 6 y 10 dígitos.' },
  { valor: 'Cédula de extranjería', formato: 'numerico', min: 6, max: 9, ayuda: 'Solo números, entre 6 y 9 dígitos.' },
  { valor: 'Pasaporte', formato: 'alfanumerico', min: 6, max: 9, ayuda: 'Letras y números, entre 6 y 9 caracteres.' },
];

const CRITERIOS_PASSWORD = [
  { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Una mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Una minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Un número', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Un carácter especial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

// Solo letras (con tildes/ñ), espacios, guion y apóstrofe — para nombres compuestos
// como "María José" o apellidos como "O'Higgins" o "De la Cruz".
function limpiarSoloLetras(valor: string): string {
  return valor.replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ' -]/g, '');
}

function limpiarDocumento(valor: string, formato: string): string {
  if (formato === 'numerico') return valor.replace(/[^0-9]/g, '');
  return valor.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

@Component({
  selector: 'app-registro-page',
  imports: [NgStyle, FormsModule, RouterLink, Icon, Autofocus],
  host: { style: 'display: contents' },
  template: `
    <main class="auth-split">
      <div class="auth-split__form auth-split__form--top" style="flex: 1 1 100%">
        <div class="auth-split__form-inner" style="max-width: 440px">
          <div [ngStyle]="s.logoArea">
            <img src="assets/logo-aguas-nacionales.png" alt="Aguas Nacionales EPM" [ngStyle]="s.logoImg" />
            <p [ngStyle]="s.brandTagline">Plataforma de Selección de Personal</p>
          </div>
          <div [ngStyle]="s.divider"></div>

          <h1 [ngStyle]="s.heading">Crear cuenta</h1>
          <p [ngStyle]="s.subheading">Regístrate para postularte a nuestras vacantes y hacer parte de nuestro talento.</p>

          @if (error()) {
            <div [ngStyle]="s.error" role="alert">{{ error() }}</div>
          }

          <div [ngStyle]="s.field">
            <label for="reg-tipo" [ngStyle]="s.label">Tipo de documento</label>
            <div [ngStyle]="s.inputWrap">
              <span [ngStyle]="s.inputIcon"><app-icon name="idCard" [size]="16" [strokeWidth]="1.6" /></span>
              <select id="reg-tipo" [ngStyle]="s.select" [ngModel]="form().tipoDocumento" (ngModelChange)="setTipoDocumento($event)">
                @for (t of tipos; track t.valor) {
                  <option [value]="t.valor">{{ t.valor }}</option>
                }
              </select>
            </div>
          </div>

          <div [ngStyle]="s.field">
            <label for="reg-doc" [ngStyle]="s.label">Número de documento</label>
            <div [ngStyle]="s.inputWrap">
              <span [ngStyle]="s.inputIcon"><app-icon name="idCard" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                id="reg-doc"
                autocomplete="off"
                [ngStyle]="m(s.input, focused() === 'doc' ? s.inputFocus : null)"
                type="text"
                [attr.inputmode]="tipoDocActual().formato === 'numerico' ? 'numeric' : 'text'"
                placeholder="Ingresa tu número de documento"
                [value]="form().numeroDocumento"
                (input)="setDocumento($event)"
                (focus)="focused.set('doc')"
                (blur)="focused.set(null)"
              />
            </div>
            <p style="font-size: 11.5px; color: #5b6b60; margin: 6px 0 0">{{ tipoDocActual().ayuda }}</p>
          </div>

          <div [ngStyle]="s.field">
            <label for="reg-nombres" [ngStyle]="s.label">Nombres</label>
            <div [ngStyle]="s.inputWrap">
              <span [ngStyle]="s.inputIcon"><app-icon name="user" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                appAutofocus
                id="reg-nombres"
                autocomplete="given-name"
                [ngStyle]="m(s.input, focused() === 'nombres' ? s.inputFocus : null)"
                type="text"
                placeholder="Ingresa tus nombres"
                [value]="form().nombres"
                (input)="setNombreApellido('nombres', $event)"
                (focus)="focused.set('nombres')"
                (blur)="focused.set(null)"
              />
            </div>
          </div>

          <div [ngStyle]="s.field">
            <label for="reg-apellidos" [ngStyle]="s.label">Apellidos</label>
            <div [ngStyle]="s.inputWrap">
              <span [ngStyle]="s.inputIcon"><app-icon name="user" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                id="reg-apellidos"
                autocomplete="family-name"
                [ngStyle]="m(s.input, focused() === 'apellidos' ? s.inputFocus : null)"
                type="text"
                placeholder="Ingresa tus apellidos"
                [value]="form().apellidos"
                (input)="setNombreApellido('apellidos', $event)"
                (focus)="focused.set('apellidos')"
                (blur)="focused.set(null)"
              />
            </div>
          </div>

          <div [ngStyle]="s.field">
            <label for="reg-email" [ngStyle]="s.label">Correo electrónico</label>
            <div [ngStyle]="s.inputWrap">
              <span [ngStyle]="s.inputIcon"><app-icon name="mail" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                id="reg-email"
                spellcheck="false"
                [ngStyle]="m(s.input, focused() === 'email' ? s.inputFocus : null)"
                type="email"
                placeholder="tu.correo@ejemplo.com"
                [value]="form().email"
                (input)="setCampo('email', $event)"
                (focus)="focused.set('email')"
                (blur)="focused.set(null)"
                autocomplete="username"
              />
            </div>
          </div>

          <div [ngStyle]="s.field">
            <label for="reg-password" [ngStyle]="s.label">Contraseña</label>
            <div [ngStyle]="s.inputWrap">
              <span [ngStyle]="s.inputIcon"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
              <input
                id="reg-password"
                aria-describedby="reg-password-criterios"
                [ngStyle]="m(s.input, { paddingRight: '44px' }, focused() === 'password' ? s.inputFocus : null)"
                [type]="mostrarPassword() ? 'text' : 'password'"
                placeholder="Crea una contraseña"
                [value]="form().password"
                (input)="setCampo('password', $event)"
                (focus)="focused.set('password')"
                (blur)="focused.set(null)"
                autocomplete="new-password"
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
            <div id="reg-password-criterios" [ngStyle]="s.passwordChecklist">
              @for (c of criterios; track c.label) {
                <div [ngStyle]="m(s.checklistItem, c.test(form().password) ? s.checklistItemOk : null)">
                  @if (c.test(form().password)) {
                    <app-icon name="check" [size]="13" [strokeWidth]="3" />
                  } @else {
                    <app-icon name="circle" [size]="13" [strokeWidth]="2" />
                  }
                  {{ c.label }}
                </div>
              }
            </div>
          </div>

          <div [ngStyle]="s.termsRow">
            <input
              type="checkbox"
              [ngStyle]="s.termsCheckbox"
              [checked]="aceptaTerminos()"
              (change)="aceptaTerminos.set($any($event.target).checked)"
              id="acepta-terminos"
            />
            <label for="acepta-terminos" [ngStyle]="s.termsText">
              Acepto la
              <a routerLink="/politica-datos" target="_blank" rel="noopener noreferrer" [ngStyle]="s.termsLink">Política de Tratamiento de Datos Personales</a>
              y los
              <a routerLink="/terminos-condiciones" target="_blank" rel="noopener noreferrer" [ngStyle]="s.termsLink">Términos y Condiciones</a>
            </label>
          </div>

          <button
            [ngStyle]="
              m(
                s.button,
                btnHover() && !cargando() && formularioCompleto() ? s.buttonHover : null,
                cargando() || !formularioCompleto() ? s.buttonDisabled : null
              )
            "
            (click)="handleRegistro()"
            (mouseenter)="btnHover.set(true)"
            (mouseleave)="btnHover.set(false)"
            [disabled]="cargando() || !formularioCompleto()"
          >
            {{ cargando() ? 'Creando cuenta…' : 'Crear cuenta' }}
            @if (!cargando()) {
              <app-icon name="arrow" [size]="17" [strokeWidth]="2" />
            }
          </button>

          <p [ngStyle]="s.switchLink">
            ¿Ya tienes cuenta? <a routerLink="/login" style="color: #0a7a30; font-weight: 600">Iniciar sesión</a>
          </p>

          <div [ngStyle]="s.benefitsBox">
            <p [ngStyle]="s.benefitsTitle">Al crear tu cuenta, podrás:</p>
            <ul [ngStyle]="s.benefitsList">
              <li [ngStyle]="s.benefitsItem"><app-icon name="check" [size]="13" [strokeWidth]="3" /> Postularte a vacantes</li>
              <li [ngStyle]="s.benefitsItem"><app-icon name="check" [size]="13" [strokeWidth]="3" /> Hacer seguimiento a tus procesos</li>
            </ul>
          </div>

          <p [ngStyle]="s.footer">Aguas Nacionales EPM · Gestión Humana</p>
        </div>
      </div>
    </main>
  `,
})
export class RegistroPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly s = authStyles;
  protected readonly tipos = TIPOS_DOCUMENTO;
  protected readonly criterios = CRITERIOS_PASSWORD;

  protected readonly form = signal({
    tipoDocumento: TIPOS_DOCUMENTO[0].valor,
    numeroDocumento: '',
    nombres: '',
    apellidos: '',
    email: '',
    password: '',
  });
  protected readonly aceptaTerminos = signal(false);
  protected readonly mostrarPassword = signal(false);
  protected readonly error = signal('');
  protected readonly cargando = signal(false);
  protected readonly focused = signal<string | null>(null);
  protected readonly btnHover = signal(false);

  protected m(...estilos: any[]): Record<string, any> {
    return Object.assign({}, ...estilos.filter(Boolean));
  }

  protected tipoDocActual() {
    return TIPOS_DOCUMENTO.find((t) => t.valor === this.form().tipoDocumento)!;
  }

  protected setCampo(key: 'email' | 'password', e: Event): void {
    const valor = (e.target as HTMLInputElement).value;
    this.form.update((f) => ({ ...f, [key]: valor }));
  }

  protected setNombreApellido(key: 'nombres' | 'apellidos', e: Event): void {
    const el = e.target as HTMLInputElement;
    const limpio = limpiarSoloLetras(el.value);
    el.value = limpio; // como en un input controlado de React: lo no permitido ni se ve
    this.form.update((f) => ({ ...f, [key]: limpio }));
  }

  protected setDocumento(e: Event): void {
    const el = e.target as HTMLInputElement;
    const tipo = this.tipoDocActual();
    const limpio = limpiarDocumento(el.value, tipo.formato).slice(0, tipo.max);
    el.value = limpio;
    this.form.update((f) => ({ ...f, numeroDocumento: limpio }));
  }

  protected setTipoDocumento(valor: string): void {
    // Al cambiar de tipo, se re-limpia el número ya escrito con las reglas del nuevo tipo.
    const nuevoTipo = TIPOS_DOCUMENTO.find((t) => t.valor === valor)!;
    this.form.update((f) => ({
      ...f,
      tipoDocumento: valor,
      numeroDocumento: limpiarDocumento(f.numeroDocumento, nuevoTipo.formato).slice(0, nuevoTipo.max),
    }));
  }

  protected formularioCompleto(): boolean {
    const form = this.form();
    const tipo = this.tipoDocActual();
    const passwordValida = CRITERIOS_PASSWORD.every((c) => c.test(form.password));
    const documentoValido = form.numeroDocumento.length >= tipo.min && form.numeroDocumento.length <= tipo.max;
    return !!(documentoValido && form.nombres.trim() && form.apellidos.trim() && form.email.trim() && passwordValida && this.aceptaTerminos());
  }

  protected async handleRegistro(): Promise<void> {
    if (!this.formularioCompleto()) {
      this.error.set('Revisa que todos los campos sean válidos, la contraseña cumpla los requisitos, y aceptes las condiciones.');
      return;
    }
    const form = this.form();
    this.error.set('');
    this.cargando.set(true);
    try {
      await this.auth.registrar({
        nombreCompleto: `${form.nombres.trim()} ${form.apellidos.trim()}`.trim(),
        email: form.email.trim(),
        password: form.password,
        cedula: form.numeroDocumento.trim(),
      });
      this.router.navigate(['/completar-perfil'], { replaceUrl: true });
    } catch (err: any) {
      this.error.set(err instanceof ApiError ? err.detail : 'No se pudo completar el registro.');
    } finally {
      this.cargando.set(false);
    }
  }
}
