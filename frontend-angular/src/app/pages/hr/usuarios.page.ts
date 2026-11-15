import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocHeader } from '../../components/doc-header';
import { AccionesMenu, Accion } from '../../components/acciones-menu';
import { Autofocus } from '../../shared/autofocus';
import { AuthService } from '../../core/auth.service';
import * as authApi from '../../lib/api/authApi';
import { ApiError } from '../../lib/api/httpClient';

const ETIQUETA_ROL: Record<string, string> = { candidato: 'Candidato', gestor_humano: 'Gestión Humana', admin: 'Administrador' };
const ROLES_ASIGNABLES = ['candidato', 'gestor_humano', 'admin'];
const FORM_VACIO = { nombreCompleto: '', email: '', password: '', rol: 'gestor_humano' };

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  selector: 'app-usuarios-page',
  imports: [CampoAccesible, FormsModule, DocHeader, AccionesMenu, Autofocus],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Usuarios" [showCode]="false" />
    <main class="page" style="max-width: 900px">
      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      }

      <div class="card">
        <div class="hr-table-actions" style="justify-content: space-between" [style.margin-bottom.px]="mostrarForm() ? 20 : 0">
          <h2 class="section-title" style="margin: 0">Usuarios registrados</h2>
          <button type="button" class="btn btn-primary btn-sm" (click)="mostrarForm.set(!mostrarForm())">
            {{ mostrarForm() ? 'Cancelar' : '+ Crear cuenta interna' }}
          </button>
        </div>

        @if (mostrarForm()) {
          <div style="border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px">
            <p class="text-muted" style="font-size: 12.5px; margin-top: -4px">
              Esto es solo para cuentas de <strong>gestor_humano</strong> o <strong>admin</strong>. Los candidatos se
              registran ellos mismos desde "Crear cuenta" en el login.
            </p>
            @if (errorForm()) {
              <div class="notice notice--danger">{{ errorForm() }}</div>
            }
            <div class="field-grid">
              <div class="field">
                <label>Nombre completo</label>
                <input type="text" [value]="form().nombreCompleto" (input)="setForm('nombreCompleto', $event)" />
              </div>
              <div class="field">
                <label>Correo electrónico</label>
                <input type="email" autocomplete="off" spellcheck="false" [value]="form().email" (input)="setForm('email', $event)" />
              </div>
              <div class="field">
                <label>Contraseña provisional</label>
                <input type="password" autocomplete="new-password" [value]="form().password" (input)="setForm('password', $event)" />
                <span class="hint">Mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial.</span>
              </div>
              <div class="field">
                <label>Rol</label>
                <select [ngModel]="form().rol" (ngModelChange)="form.set({ ...form(), rol: $event })">
                  <option value="gestor_humano">Gestión Humana</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <button type="button" class="btn btn-primary mt-24" (click)="handleCrear()" [disabled]="creando()">
              {{ creando() ? 'Creando…' : 'Crear cuenta' }}
            </button>
          </div>
        }

        @if (usuarios() === null) {
          <p class="text-muted">Cargando…</p>
        } @else {
          <div class="field mt-24" style="max-width: 320px">
            <input type="search" aria-label="Buscar usuarios" autocomplete="off" placeholder="Buscar por nombre o correo…" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
          </div>
          <table class="plain-table" style="margin-top: 14px">
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              @for (u of usuariosFiltrados(); track u.id) {
                <tr>
                  <td>
                    @if (editandoNombreId() === u.id) {
                      <div style="display: flex; gap: 6px; align-items: center">
                        <input
                          type="text"
                          appAutofocus
                          aria-label="Nuevo nombre"
                          [value]="nombreEnEdicion()"
                          (input)="nombreEnEdicion.set($any($event.target).value)"
                          (keydown.enter)="guardarNombre(u.id)"
                          style="font-size: 13px; padding: 3px 6px; width: 160px"
                        />
                        <button type="button" class="hr-link-btn" aria-label="Guardar nombre" [disabled]="guardandoNombre()" (click)="guardarNombre(u.id)">✓</button>
                        <button type="button" class="hr-link-btn" aria-label="Cancelar edición" (click)="editandoNombreId.set(null)">✕</button>
                      </div>
                    } @else {
                      {{ u.nombreCompleto }}
                    }
                  </td>
                  <td>{{ u.email }}</td>
                  <td>
                    @if (editandoRolId() === u.id) {
                      <select
                        appAutofocus
                        aria-label="Rol del usuario"
                        [ngModel]="u.rol"
                        [disabled]="cambiandoRolId() === u.id"
                        (ngModelChange)="handleCambiarRol(u.id, $event)"
                        (blur)="editandoRolId.set(null)"
                        style="font-size: 12.5px; padding: 4px 8px; width: auto"
                      >
                        @for (r of rolesAsignables; track r) {
                          <option [value]="r">{{ etiquetaRol[r] }}</option>
                        }
                      </select>
                    } @else {
                      <span class="estado-badge estado-badge--preseleccionado">{{ etiquetaRol[u.rol] }}</span>
                    }
                  </td>
                  <td>
                    <span class="estado-badge" [class.estado-badge--aceptada]="u.activo" [class.estado-badge--rechazada]="!u.activo">
                      {{ u.activo ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td>
                    @if (u.id === auth.usuario()?.id) {
                      <span class="text-muted" style="font-size: 11.5px">(tú)</span>
                    } @else if (procesandoEstadoId() === u.id) {
                      <span class="text-muted" style="font-size: 11.5px">Procesando…</span>
                    } @else {
                      <app-acciones-menu [acciones]="accionesDe(u)" />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </main>
  `,
})
export class UsuariosPage {
  protected readonly auth = inject(AuthService);
  protected readonly etiquetaRol = ETIQUETA_ROL;
  protected readonly rolesAsignables = ROLES_ASIGNABLES;

  protected readonly usuarios = signal<any[] | null>(null);
  protected readonly error = signal('');

  protected readonly mostrarForm = signal(false);
  protected readonly form = signal({ ...FORM_VACIO });
  protected readonly errorForm = signal('');
  protected readonly creando = signal(false);

  protected readonly cambiandoRolId = signal<string | null>(null);
  protected readonly editandoNombreId = signal<string | null>(null);
  protected readonly nombreEnEdicion = signal('');
  protected readonly guardandoNombre = signal(false);
  protected readonly editandoRolId = signal<string | null>(null);
  protected readonly busqueda = signal('');
  protected readonly procesandoEstadoId = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.usuarios.set(await authApi.listarUsuarios(this.auth.token()));
    } catch {
      this.error.set('No se pudo cargar la lista de usuarios.');
    }
  }

  protected setForm(key: 'nombreCompleto' | 'email' | 'password', e: Event): void {
    const valor = (e.target as HTMLInputElement).value;
    this.form.update((f) => ({ ...f, [key]: valor }));
  }

  protected usuariosFiltrados(): any[] {
    const busqueda = this.busqueda();
    return (this.usuarios() || []).filter((u) => {
      if (!busqueda.trim()) return true;
      return `${u.nombreCompleto} ${u.email}`.toLowerCase().includes(busqueda.toLowerCase());
    });
  }

  protected accionesDe(u: any): Accion[] {
    return [
      { etiqueta: 'Cambiar nombre', onClick: () => this.iniciarEdicionNombre(u) },
      { etiqueta: 'Cambiar rol', onClick: () => this.editandoRolId.set(u.id) },
      u.activo
        ? { etiqueta: 'Desactivar cuenta', onClick: () => this.handleDesactivar(u), danger: true }
        : { etiqueta: 'Reactivar cuenta', onClick: () => this.handleReactivar(u) },
    ];
  }

  protected async handleCrear(): Promise<void> {
    this.errorForm.set('');
    this.creando.set(true);
    try {
      await authApi.crearUsuarioInterno(this.form(), this.auth.token());
      this.form.set({ ...FORM_VACIO });
      this.mostrarForm.set(false);
      await this.cargar();
    } catch (err: any) {
      this.errorForm.set(err instanceof ApiError ? err.detail : 'No se pudo crear la cuenta.');
    } finally {
      this.creando.set(false);
    }
  }

  protected async handleCambiarRol(usuarioId: string, nuevoRol: string): Promise<void> {
    this.cambiandoRolId.set(usuarioId);
    try {
      await authApi.editarUsuario(usuarioId, { rol: nuevoRol }, this.auth.token());
      this.editandoRolId.set(null);
      await this.cargar();
    } catch (err: any) {
      alert(err instanceof ApiError ? err.detail : 'No se pudo cambiar el rol.');
    } finally {
      this.cambiandoRolId.set(null);
    }
  }

  private iniciarEdicionNombre(u: any): void {
    this.editandoNombreId.set(u.id);
    this.nombreEnEdicion.set(u.nombreCompleto);
  }

  protected async guardarNombre(usuarioId: string): Promise<void> {
    if (this.nombreEnEdicion().trim().length < 3) {
      alert('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    this.guardandoNombre.set(true);
    try {
      await authApi.editarUsuario(usuarioId, { nombreCompleto: this.nombreEnEdicion().trim() }, this.auth.token());
      this.editandoNombreId.set(null);
      await this.cargar();
    } catch (err: any) {
      alert(err instanceof ApiError ? err.detail : 'No se pudo cambiar el nombre.');
    } finally {
      this.guardandoNombre.set(false);
    }
  }

  private async handleDesactivar(u: any): Promise<void> {
    if (!window.confirm(`¿Desactivar la cuenta de ${u.nombreCompleto}? No podrá iniciar sesión hasta que la reactives.`)) return;
    this.procesandoEstadoId.set(u.id);
    try {
      await authApi.desactivarCuentaDeOtro(u.id, this.auth.token());
      await this.cargar();
    } catch (err: any) {
      alert(err instanceof ApiError ? err.detail : 'No se pudo desactivar la cuenta.');
    } finally {
      this.procesandoEstadoId.set(null);
    }
  }

  private async handleReactivar(u: any): Promise<void> {
    this.procesandoEstadoId.set(u.id);
    try {
      await authApi.reactivarCuenta(u.id, this.auth.token());
      await this.cargar();
    } catch (err: any) {
      alert(err instanceof ApiError ? err.detail : 'No se pudo reactivar la cuenta.');
    } finally {
      this.procesandoEstadoId.set(null);
    }
  }
}
