import { Component, computed, inject, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, RegistroSinSesionError } from '../core/auth.service';
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

// Mismos topes que el backend (nombre_completo ≤ 200, password ≤ 100).
const MAX_NOMBRE = 100;
const MAX_EMAIL = 254;
const MAX_PASSWORD = 100;

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Campo = 'doc' | 'nombres' | 'apellidos' | 'email' | 'password' | 'terminos';
// Orden visual del formulario: al enviar con errores, el foco va al primero.
const ORDEN_CAMPOS: Campo[] = ['nombres', 'apellidos', 'doc', 'email', 'password', 'terminos'];
const ID_CAMPO: Record<Campo, string> = {
  doc: 'reg-doc',
  nombres: 'reg-nombres',
  apellidos: 'reg-apellidos',
  email: 'reg-email',
  password: 'reg-password',
  terminos: 'acepta-terminos',
};
// Nombre del campo en el backend → campo del formulario (errores 422).
const CAMPO_BACKEND: Record<string, Campo> = {
  cedula: 'doc',
  nombre_completo: 'nombres',
  email: 'email',
  password: 'password',
};

// Letras de cualquier idioma (María, Çelik, Nguyễn), espacios, guion y apóstrofe —
// para nombres compuestos como "María José" o apellidos como "O'Higgins" o "De la Cruz".
function limpiarSoloLetras(valor: string): string {
  return valor.replace(/[^\p{L}\p{M}' -]/gu, '');
}

function limpiarDocumento(valor: string, formato: string): string {
  if (formato === 'numerico') return valor.replace(/[^0-9]/g, '');
  return valor.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Aplica `limpiar` al valor del input sin que el cursor salte al final:
 * el cursor queda justo después de lo que la persona alcanzó a escribir.
 */
function limpiarConCursor(el: HTMLInputElement, limpiar: (v: string) => string): { limpio: string; quitado: boolean } {
  const original = el.value;
  const pos = el.selectionStart ?? original.length;
  const limpio = limpiar(original);
  if (limpio !== original) {
    const nuevaPos = Math.min(limpiar(original.slice(0, pos)).length, limpio.length);
    el.value = limpio; // como en un input controlado de React: lo no permitido ni se ve
    el.setSelectionRange(nuevaPos, nuevaPos);
  }
  return { limpio, quitado: limpio.length < original.length };
}

@Component({
  selector: 'app-registro-page',
  imports: [NgStyle, FormsModule, RouterLink, Icon, Autofocus],
  host: { style: 'display: contents' },
  template: `
    <main class="auth-split">
      <div class="auth-split__form auth-split__form--top">
        <div class="auth-split__form-inner" style="max-width: 440px">
          <!-- En escritorio el logo va sobre la foto; este solo se ve en pantallas angostas (igual que el login). -->
          <div class="auth-split__mobile-logo">
            <img src="assets/logo-aguas-nacionales.png" alt="Aguas Nacionales EPM" />
            <p [ngStyle]="s.brandTagline">Plataforma de Selección de Personal</p>
          </div>

          <h1 [ngStyle]="s.heading">Crear cuenta</h1>
          <p [ngStyle]="m(s.subheading, { marginBottom: '10px' })">Regístrate para postularte a nuestras vacantes y hacer parte de nuestro talento.</p>
          <!-- Beneficios antes del formulario (donde motivan), en una línea compacta; antes iban en un recuadro después del botón. -->
          <ul [ngStyle]="m(s.benefitsList, { flexDirection: 'row', flexWrap: 'wrap', gap: '6px 16px', marginBottom: '22px' })" aria-label="Al crear tu cuenta, podrás">
            <li [ngStyle]="s.benefitsItem"><app-icon name="check" [size]="13" [strokeWidth]="3" /> Postularte a vacantes</li>
            <li [ngStyle]="s.benefitsItem"><app-icon name="check" [size]="13" [strokeWidth]="3" /> Seguir tus procesos</li>
          </ul>

          <!-- novalidate: los mensajes los da el formulario (en español y junto a cada campo), no el navegador. -->
          <form (ngSubmit)="handleRegistro()" novalidate>
            <div [ngStyle]="s.field">
              <label for="reg-nombres" [ngStyle]="s.label">Nombres</label>
              <div [ngStyle]="s.inputWrap">
                <span [ngStyle]="s.inputIcon"><app-icon name="user" [size]="16" [strokeWidth]="1.6" /></span>
                <input
                  appAutofocus
                  id="reg-nombres"
                  name="nombres"
                  autocomplete="given-name"
                  [ngStyle]="estiloInput('nombres')"
                  type="text"
                  [attr.maxlength]="maxNombre"
                  placeholder="Ingresa tus nombres"
                  [value]="form().nombres"
                  (input)="setNombreApellido('nombres', $event)"
                  (focus)="focused.set('nombres')"
                  (blur)="focused.set(null)"
                  [attr.aria-invalid]="errores()['nombres'] ? 'true' : null"
                  [attr.aria-describedby]="errores()['nombres'] ? 'reg-nombres-error' : null"
                />
              </div>
              @if (errores()['nombres']) {
                <p id="reg-nombres-error" [ngStyle]="s.fieldError">{{ errores()['nombres'] }}</p>
              }
              <p aria-live="polite" [ngStyle]="caracterQuitado() === 'nombres' ? s.fieldHint : { margin: 0 }">
                {{ caracterQuitado() === 'nombres' ? 'Solo se permiten letras, espacios, guion y apóstrofe.' : '' }}
              </p>
            </div>

            <div [ngStyle]="s.field">
              <label for="reg-apellidos" [ngStyle]="s.label">Apellidos</label>
              <div [ngStyle]="s.inputWrap">
                <span [ngStyle]="s.inputIcon"><app-icon name="user" [size]="16" [strokeWidth]="1.6" /></span>
                <input
                  id="reg-apellidos"
                  name="apellidos"
                  autocomplete="family-name"
                  [ngStyle]="estiloInput('apellidos')"
                  type="text"
                  [attr.maxlength]="maxNombre"
                  placeholder="Ingresa tus apellidos"
                  [value]="form().apellidos"
                  (input)="setNombreApellido('apellidos', $event)"
                  (focus)="focused.set('apellidos')"
                  (blur)="focused.set(null)"
                  [attr.aria-invalid]="errores()['apellidos'] ? 'true' : null"
                  [attr.aria-describedby]="errores()['apellidos'] ? 'reg-apellidos-error' : null"
                />
              </div>
              @if (errores()['apellidos']) {
                <p id="reg-apellidos-error" [ngStyle]="s.fieldError">{{ errores()['apellidos'] }}</p>
              }
              <p aria-live="polite" [ngStyle]="caracterQuitado() === 'apellidos' ? s.fieldHint : { margin: 0 }">
                {{ caracterQuitado() === 'apellidos' ? 'Solo se permiten letras, espacios, guion y apóstrofe.' : '' }}
              </p>
            </div>

            <div [ngStyle]="s.field">
              <label for="reg-tipo" [ngStyle]="s.label">Tipo de documento</label>
              <div [ngStyle]="s.inputWrap">
                <span [ngStyle]="s.inputIcon"><app-icon name="idCard" [size]="16" [strokeWidth]="1.6" /></span>
                <select
                  id="reg-tipo"
                  name="tipoDocumento"
                  [ngStyle]="m(s.select, focused() === 'tipo' ? s.inputFocus : null)"
                  [ngModel]="form().tipoDocumento"
                  (ngModelChange)="setTipoDocumento($event)"
                  (focus)="focused.set('tipo')"
                  (blur)="focused.set(null)"
                >
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
                  name="numeroDocumento"
                  autocomplete="off"
                  [ngStyle]="estiloInput('doc')"
                  type="text"
                  [attr.inputmode]="tipoDocActual().formato === 'numerico' ? 'numeric' : 'text'"
                  [attr.maxlength]="tipoDocActual().max"
                  placeholder="Ingresa tu número de documento"
                  [value]="form().numeroDocumento"
                  (input)="setDocumento($event)"
                  (focus)="focused.set('doc')"
                  (blur)="focused.set(null)"
                  [attr.aria-invalid]="errores()['doc'] ? 'true' : null"
                  [attr.aria-describedby]="errores()['doc'] ? 'reg-doc-error reg-doc-ayuda' : 'reg-doc-ayuda'"
                />
              </div>
              @if (errores()['doc']) {
                <p id="reg-doc-error" [ngStyle]="s.fieldError">{{ errores()['doc'] }}</p>
              }
              <p id="reg-doc-ayuda" [ngStyle]="s.fieldHint">{{ tipoDocActual().ayuda }}</p>
            </div>

            <div [ngStyle]="s.field">
              <label for="reg-email" [ngStyle]="s.label">Correo electrónico</label>
              <div [ngStyle]="s.inputWrap">
                <span [ngStyle]="s.inputIcon"><app-icon name="mail" [size]="16" [strokeWidth]="1.6" /></span>
                <input
                  id="reg-email"
                  name="email"
                  spellcheck="false"
                  [ngStyle]="estiloInput('email')"
                  type="email"
                  [attr.maxlength]="maxEmail"
                  placeholder="tu.correo@ejemplo.com"
                  [value]="form().email"
                  (input)="setCampo('email', $event)"
                  (focus)="focused.set('email')"
                  (blur)="focused.set(null)"
                  autocomplete="username"
                  [attr.aria-invalid]="errores()['email'] ? 'true' : null"
                  [attr.aria-describedby]="errores()['email'] ? 'reg-email-error' : null"
                />
              </div>
              @if (errores()['email']) {
                <div id="reg-email-error">
                  <p [ngStyle]="s.fieldError">{{ errores()['email'] }}</p>
                  @if (correoDuplicado()) {
                    <p [ngStyle]="s.fieldHint">
                      ¿Es tu cuenta?
                      <a routerLink="/login" [ngStyle]="s.termsLink">Inicia sesión</a>
                      o
                      <a routerLink="/olvide-password" [ngStyle]="s.termsLink">recupera tu contraseña</a>.
                    </p>
                  }
                </div>
              }
            </div>

            <div [ngStyle]="s.field">
              <label for="reg-password" [ngStyle]="s.label">Contraseña</label>
              <div [ngStyle]="s.inputWrap">
                <span [ngStyle]="s.inputIcon"><app-icon name="lock" [size]="16" [strokeWidth]="1.6" /></span>
                <input
                  id="reg-password"
                  name="password"
                  [attr.aria-describedby]="errores()['password'] ? 'reg-password-error reg-password-criterios' : 'reg-password-criterios'"
                  [attr.aria-invalid]="errores()['password'] ? 'true' : null"
                  [ngStyle]="estiloInput('password', { paddingRight: '44px' })"
                  [type]="mostrarPassword() ? 'text' : 'password'"
                  [attr.maxlength]="maxPassword"
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
              @if (errores()['password']) {
                <p id="reg-password-error" [ngStyle]="s.fieldError">{{ errores()['password'] }}</p>
              }
              <ul id="reg-password-criterios" [ngStyle]="m(s.passwordChecklist, { listStyle: 'none', padding: 0 })">
                @for (c of criterios; track c.label) {
                  <li [ngStyle]="m(s.checklistItem, c.test(form().password) ? s.checklistItemOk : null)">
                    @if (c.test(form().password)) {
                      <app-icon name="check" [size]="13" [strokeWidth]="3" />
                    } @else {
                      <app-icon name="circle" [size]="13" [strokeWidth]="2" />
                    }
                    {{ c.label }}<span class="sr-only">{{ c.test(form().password) ? ': cumplido' : ': pendiente' }}</span>
                  </li>
                }
              </ul>
              <!-- Anuncia solo cuando cambia cuántos requisitos faltan, no en cada tecla. -->
              <p class="sr-only" aria-live="polite">{{ resumenPassword() }}</p>
            </div>

            <div [ngStyle]="m(s.termsRow, errores()['terminos'] ? { marginBottom: '6px' } : null)">
              <!-- Label sin texto alrededor de la casilla: agranda la zona táctil a ~44px (el nombre accesible lo da el label de al lado). -->
              <label style="display: flex; padding: 12px; margin: -12px -3px -12px -12px; cursor: pointer; flex-shrink: 0">
              <input
                type="checkbox"
                name="aceptaTerminos"
                [ngStyle]="s.termsCheckbox"
                [checked]="aceptaTerminos()"
                (change)="setTerminos($any($event.target).checked)"
                id="acepta-terminos"
                [attr.aria-invalid]="errores()['terminos'] ? 'true' : null"
                [attr.aria-describedby]="errores()['terminos'] ? 'reg-terminos-error' : null"
              />
              </label>
              <label for="acepta-terminos" [ngStyle]="s.termsText">
                Acepto la
                <a routerLink="/politica-datos" target="_blank" rel="noopener noreferrer" [ngStyle]="s.termsLink">Política de Tratamiento de Datos Personales<span class="sr-only"> (se abre en otra pestaña)</span></a>
                y los
                <a routerLink="/terminos-condiciones" target="_blank" rel="noopener noreferrer" [ngStyle]="s.termsLink">Términos y Condiciones<span class="sr-only"> (se abre en otra pestaña)</span></a>
              </label>
            </div>
            @if (errores()['terminos']) {
              <p id="reg-terminos-error" [ngStyle]="m(s.fieldError, { margin: '0 0 20px' })">{{ errores()['terminos'] }}</p>
            }

            <!-- Errores generales (sin conexión, demasiados intentos…): junto al botón, donde la persona está mirando. -->
            @if (error()) {
              <div [ngStyle]="s.error" role="alert">{{ error() }}</div>
            }

            <button
              type="submit"
              class="auth-btn"
              [disabled]="cargando()"
            >
              @if (cargando()) {
                <span class="auth-btn__spinner" aria-hidden="true"></span>
              }
              {{ cargando() ? 'Creando cuenta…' : 'Crear cuenta' }}
              @if (!cargando()) {
                <app-icon name="arrow" [size]="17" [strokeWidth]="2" />
              }
            </button>
          </form>

          <p [ngStyle]="s.switchLink">
            ¿Ya tienes cuenta? <a routerLink="/login" style="color: #0a7a30; font-weight: 600">Iniciar sesión</a>
          </p>

          <p [ngStyle]="s.footer">Aguas Nacionales EPM · Gestión Humana</p>
        </div>
      </div>

      <!-- Columna izquierda — misma foto PROVISIONAL del login, para que ambas pantallas se vean del mismo producto.
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
export class RegistroPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly s = authStyles;
  protected readonly tipos = TIPOS_DOCUMENTO;
  protected readonly criterios = CRITERIOS_PASSWORD;
  protected readonly maxNombre = MAX_NOMBRE;
  protected readonly maxEmail = MAX_EMAIL;
  protected readonly maxPassword = MAX_PASSWORD;

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
  /** Error general (no ligado a un campo). */
  protected readonly error = signal('');
  protected readonly cargando = signal(false);
  protected readonly focused = signal<string | null>(null);
  /** Campo en el que se acaba de quitar un carácter no permitido (para avisar). */
  protected readonly caracterQuitado = signal<'nombres' | 'apellidos' | null>(null);

  /** Tras el primer intento de envío, los errores se muestran y se actualizan en vivo. */
  private readonly intentado = signal(false);
  /** Errores que devolvió el servidor, por campo; se borran al editar ese campo. */
  private readonly erroresServidor = signal<Partial<Record<Campo, string>>>({});
  protected readonly correoDuplicado = signal(false);

  protected readonly errores = computed<Partial<Record<Campo, string>>>(() => ({
    ...(this.intentado() ? this.validar() : {}),
    ...this.erroresServidor(),
  }));

  protected readonly resumenPassword = computed(() => {
    const p = this.form().password;
    if (!p) return '';
    const faltan = CRITERIOS_PASSWORD.filter((c) => !c.test(p)).length;
    if (faltan === 0) return 'La contraseña cumple todos los requisitos.';
    return faltan === 1 ? 'Falta 1 requisito de la contraseña.' : `Faltan ${faltan} requisitos de la contraseña.`;
  });

  protected m(...estilos: any[]): Record<string, any> {
    return Object.assign({}, ...estilos.filter(Boolean));
  }

  protected estiloInput(campo: Campo, extra?: Record<string, any>): Record<string, any> {
    const enfocado = this.focused() === campo;
    const invalido = !!this.errores()[campo];
    return this.m(
      this.s['input'],
      extra,
      enfocado ? this.s['inputFocus'] : null,
      invalido ? (enfocado ? this.s['inputInvalidFocus'] : this.s['inputInvalid']) : null,
    );
  }

  protected tipoDocActual() {
    return TIPOS_DOCUMENTO.find((t) => t.valor === this.form().tipoDocumento)!;
  }

  private limpiarErrorServidor(campo: Campo): void {
    if (!this.erroresServidor()[campo]) return;
    this.erroresServidor.update(({ [campo]: _, ...resto }) => resto);
    if (campo === 'email') this.correoDuplicado.set(false);
  }

  protected setCampo(key: 'email' | 'password', e: Event): void {
    const valor = (e.target as HTMLInputElement).value;
    this.form.update((f) => ({ ...f, [key]: valor }));
    this.limpiarErrorServidor(key);
  }

  protected setNombreApellido(key: 'nombres' | 'apellidos', e: Event): void {
    const { limpio, quitado } = limpiarConCursor(e.target as HTMLInputElement, limpiarSoloLetras);
    this.caracterQuitado.set(quitado ? key : null);
    this.form.update((f) => ({ ...f, [key]: limpio }));
    this.limpiarErrorServidor(key);
  }

  protected setDocumento(e: Event): void {
    const tipo = this.tipoDocActual();
    const { limpio } = limpiarConCursor(e.target as HTMLInputElement, (v) => limpiarDocumento(v, tipo.formato).slice(0, tipo.max));
    this.form.update((f) => ({ ...f, numeroDocumento: limpio }));
    this.limpiarErrorServidor('doc');
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

  protected setTerminos(valor: boolean): void {
    this.aceptaTerminos.set(valor);
  }

  private validar(): Partial<Record<Campo, string>> {
    const f = this.form();
    const tipo = this.tipoDocActual();
    const e: Partial<Record<Campo, string>> = {};

    if (!f.numeroDocumento) {
      e.doc = 'Ingresa tu número de documento.';
    } else if (f.numeroDocumento.length < tipo.min || f.numeroDocumento.length > tipo.max) {
      const unidad = tipo.formato === 'numerico' ? 'dígitos' : 'caracteres';
      e.doc = `Debe tener entre ${tipo.min} y ${tipo.max} ${unidad} (tiene ${f.numeroDocumento.length}).`;
    }
    if (!f.nombres.trim()) e.nombres = 'Ingresa tus nombres.';
    if (!f.apellidos.trim()) e.apellidos = 'Ingresa tus apellidos.';
    if (!f.email.trim()) {
      e.email = 'Ingresa tu correo electrónico.';
    } else if (!EMAIL_VALIDO.test(f.email.trim())) {
      e.email = 'Revisa el correo: debe verse como nombre@dominio.com.';
    }
    if (!f.password) {
      e.password = 'Crea una contraseña.';
    } else if (!CRITERIOS_PASSWORD.every((c) => c.test(f.password))) {
      e.password = 'La contraseña aún no cumple todos los requisitos de abajo.';
    }
    if (!this.aceptaTerminos()) {
      e.terminos = 'Para crear tu cuenta debes aceptar la política de datos y los términos.';
    }
    return e;
  }

  /** Lleva el foco (y la vista) al primer campo con error, en el orden del formulario. */
  private enfocarPrimerError(errores: Partial<Record<Campo, string>>): void {
    const primero = ORDEN_CAMPOS.find((c) => errores[c]);
    if (!primero) return;
    // Espera a que Angular pinte los mensajes para que el lector de pantalla los lea al enfocar.
    setTimeout(() => {
      const el = document.getElementById(ID_CAMPO[primero]);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  protected async handleRegistro(): Promise<void> {
    if (this.cargando()) return;
    this.intentado.set(true);
    this.error.set('');

    const errores = this.validar();
    if (Object.keys(errores).length) {
      this.enfocarPrimerError(errores);
      return;
    }

    const form = this.form();
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
      if (err instanceof RegistroSinSesionError) {
        // La cuenta existe: se manda al login con el correo listo, en vez de dejar reintentar el registro.
        this.router.navigate(['/login'], { replaceUrl: true, state: { cuentaCreada: true, email: form.email.trim() } });
        return;
      }
      this.mostrarErrorServidor(err);
    } finally {
      this.cargando.set(false);
    }
  }

  private mostrarErrorServidor(err: any): void {
    if (!(err instanceof ApiError)) {
      this.error.set('No se pudo completar el registro. Inténtalo de nuevo.');
      return;
    }

    // 409: correo o cédula ya registrados → se muestra en el campo correspondiente.
    if (err.status === 409) {
      if (/correo/i.test(err.detail)) {
        this.erroresServidor.set({ email: err.detail });
        this.correoDuplicado.set(true);
        this.enfocarPrimerError({ email: err.detail });
        return;
      }
      if (/c[eé]dula|documento/i.test(err.detail)) {
        this.erroresServidor.set({ doc: err.detail });
        this.enfocarPrimerError({ doc: err.detail });
        return;
      }
    }

    // 422: validación del backend con errores por campo.
    const porCampo: Partial<Record<Campo, string>> = {};
    for (const [campoBackend, mensaje] of Object.entries(err.campos)) {
      const campo = CAMPO_BACKEND[campoBackend];
      if (campo) porCampo[campo] = mensaje;
    }
    if (Object.keys(porCampo).length) {
      this.erroresServidor.set(porCampo);
      this.enfocarPrimerError(porCampo);
      return;
    }

    this.error.set(err.detail);
  }
}
