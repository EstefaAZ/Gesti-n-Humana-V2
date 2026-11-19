import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocHeader } from '../../components/doc-header';
import { AccionesMenu, Accion } from '../../components/acciones-menu';
import { Autofocus } from '../../shared/autofocus';
import { Icon } from '../../shared/icon';
import { AuthService } from '../../core/auth.service';
import * as authApi from '../../lib/api/authApi';
import { ApiError } from '../../lib/api/httpClient';
import { CampoAccesible } from '../../shared/campo-accesible';

const ETIQUETA_ROL: Record<string, string> = { candidato: 'Candidato', gestor_humano: 'Gestión Humana', admin: 'Administrador' };
const ROLES_ASIGNABLES = ['candidato', 'gestor_humano', 'admin'];
const FORM_VACIO = { nombreCompleto: '', email: '', password: '', rol: 'gestor_humano' };
const POR_PAGINA = 25;

type Filtro = 'todos' | 'candidato' | 'gestor_humano' | 'admin' | 'inactivos';

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

@Component({
  selector: 'app-usuarios-page',
  imports: [CampoAccesible, FormsModule, DocHeader, AccionesMenu, Autofocus, Icon],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Usuarios" />
    <main class="page">
      <div class="ps-encabezado">
        <div>
          <h2 class="ps-encabezado__titulo">Usuarios</h2>
          <p class="ps-encabezado__resumen">
            @if (usuarios()) {
              <strong>{{ usuarios()!.length }}</strong> cuentas · <strong>{{ cuantos('inactivos') }}</strong> inactivas
            } @else {
              Cuentas de candidatos y del equipo interno.
            }
          </p>
        </div>
        @if (!mostrarForm()) {
          <button type="button" class="btn btn-primary btn-sm" (click)="abrirForm()">
            <app-icon name="mas" [size]="15" [strokeWidth]="2.2" />Crear cuenta interna
          </button>
        }
      </div>

      @if (aviso()) {
        <div class="notice" [class.notice--danger]="aviso()!.tipo === 'error'" [class.notice--success]="aviso()!.tipo === 'ok'" role="status">
          {{ aviso()!.texto }}
          <button type="button" class="hr-link-btn us-aviso__cerrar" aria-label="Cerrar aviso" (click)="aviso.set(null)"><app-icon name="cerrar" [size]="14" [strokeWidth]="2" /></button>
        </div>
      }

      @if (mostrarForm()) {
        <section class="ps-tarjeta mp-seccion us-form" aria-labelledby="us-form-titulo">
          <div class="mp-seccion__cabecera">
            <span class="mp-seccion__icono" aria-hidden="true"><app-icon name="persona" [size]="18" [strokeWidth]="2" /></span>
            <div style="flex: 1">
              <h3 class="mp-seccion__titulo" id="us-form-titulo">Nueva cuenta interna</h3>
              <p class="mp-seccion__sub">Para personas de Gestión Humana o administradores. Los candidatos crean su propia cuenta desde el inicio de sesión.</p>
            </div>
          </div>

          @if (errorForm()) {
            <div class="notice notice--danger">{{ errorForm() }}</div>
          }

          <fieldset class="us-roles">
            <legend class="us-roles__leyenda">Rol</legend>
            @for (r of rolesInternos; track r.valor) {
              <label class="us-rol" [class.is-activo]="form().rol === r.valor">
                <input type="radio" name="rol-nuevo" [value]="r.valor" [checked]="form().rol === r.valor" (change)="form.set({ ...form(), rol: r.valor })" />
                <span class="us-rol__titulo">{{ r.etiqueta }}</span>
                <span class="us-rol__texto">{{ r.ayuda }}</span>
              </label>
            }
          </fieldset>

          <div class="field-grid">
            <div class="field">
              <label for="us-nombre">Nombre completo</label>
              <input id="us-nombre" type="text" appAutofocus [value]="form().nombreCompleto" (input)="setForm('nombreCompleto', $event)" />
            </div>
            <div class="field">
              <label for="us-email">Correo electrónico</label>
              <input id="us-email" type="email" autocomplete="off" spellcheck="false" [value]="form().email" (input)="setForm('email', $event)" />
            </div>
            <div class="field">
              <label for="us-password">Contraseña provisional</label>
              <input id="us-password" type="password" autocomplete="new-password" [value]="form().password" (input)="setForm('password', $event)" />
              <span class="hint">Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial. Compártela por un canal seguro.</span>
            </div>
          </div>

          <div class="mp-acciones">
            <button type="button" class="btn btn-secondary" (click)="cerrarForm()" [disabled]="creando()">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="handleCrear()" [disabled]="creando() || !formCompleto()">
              {{ creando() ? 'Creando…' : 'Crear cuenta' }}
            </button>
          </div>
        </section>
      }

      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      } @else if (usuarios() === null) {
        <div class="ps-tarjeta cand-vacio"><p class="text-muted" style="margin: 0">Cargando usuarios…</p></div>
      } @else {
        <div class="ps-tarjeta">
          <div class="ps-barra">
            <div class="ps-buscador">
              <span class="ps-buscador__icono" aria-hidden="true"><app-icon name="buscar" [size]="16" [strokeWidth]="2" /></span>
              <input type="search" aria-label="Buscar usuarios" autocomplete="off" placeholder="Buscar por nombre, correo o cédula…" [value]="busqueda()" (input)="busqueda.set($any($event.target).value); limite.set(porPagina)" />
            </div>
            <div class="ps-filtros" role="group" aria-label="Filtrar por rol">
              @for (f of filtros; track f.valor) {
                <button type="button" class="ps-chip" [class.is-activo]="filtro() === f.valor" [class.is-vacio]="cuantos(f.valor) === 0" [attr.aria-pressed]="filtro() === f.valor" (click)="filtro.set(f.valor); limite.set(porPagina)">
                  {{ f.etiqueta }} <span class="ps-chip__conteo">{{ cuantos(f.valor) }}</span>
                </button>
              }
            </div>
          </div>

          @if (filtrados().length === 0) {
            <div class="ps-vacio">
              <p style="margin: 0">Ningún usuario coincide con la búsqueda o el filtro.</p>
              <button type="button" class="btn btn-secondary btn-sm" (click)="busqueda.set(''); filtro.set('todos')">Ver todos los usuarios</button>
            </div>
          } @else {
            <div style="overflow-x: auto">
              <table class="ps-tabla ps-tabla--vacantes us-tabla">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Registro</th>
                    <th><span class="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of visibles(); track u.id) {
                    <tr [class.is-inactivo]="!u.activo">
                      <td>
                        <div class="us-usuario">
                          <span class="us-avatar us-avatar--{{ u.rol }}" aria-hidden="true">{{ iniciales(u.nombreCompleto) }}</span>
                          <div class="us-usuario__texto">
                            @if (editandoNombreId() === u.id) {
                              <div class="us-editar">
                                <input
                                  type="text"
                                  appAutofocus
                                  aria-label="Nuevo nombre"
                                  [value]="nombreEnEdicion()"
                                  (input)="nombreEnEdicion.set($any($event.target).value)"
                                  (keydown.enter)="guardarNombre(u.id)"
                                  (keydown.escape)="editandoNombreId.set(null)"
                                />
                                <button type="button" class="btn btn-primary btn-sm" [disabled]="guardandoNombre()" (click)="guardarNombre(u.id)">Guardar</button>
                                <button type="button" class="btn btn-secondary btn-sm" (click)="editandoNombreId.set(null)">Cancelar</button>
                              </div>
                            } @else {
                              <span class="ps-aspirante">
                                {{ u.nombreCompleto }}
                                @if (u.id === auth.usuario()?.id) {
                                  <span class="us-tu">Tú</span>
                                }
                              </span>
                            }
                            <span class="us-correo">{{ u.email }}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        @if (editandoRolId() === u.id) {
                          <select
                            appAutofocus
                            class="us-select-rol"
                            aria-label="Rol del usuario"
                            [ngModel]="u.rol"
                            [disabled]="cambiandoRolId() === u.id"
                            (ngModelChange)="handleCambiarRol(u, $event)"
                            (blur)="editandoRolId.set(null)"
                            (keydown.escape)="editandoRolId.set(null)"
                          >
                            @for (r of rolesAsignables; track r) {
                              <option [value]="r">{{ etiquetaRol[r] }}</option>
                            }
                          </select>
                        } @else {
                          <span class="us-rol-pill us-rol-pill--{{ u.rol }}">{{ etiquetaRol[u.rol] || u.rol }}</span>
                        }
                      </td>
                      <td>
                        <span class="us-estado" [class.is-activo]="u.activo"><span class="us-estado__punto"></span>{{ u.activo ? 'Activa' : 'Inactiva' }}</span>
                      </td>
                      <td class="us-fecha">{{ fecha(u.fechaCreacion) }}</td>
                      <td style="text-align: right; width: 1%">
                        @if (u.id === auth.usuario()?.id) {
                          <span class="sr-only">Tu propia cuenta se edita en Mi perfil</span>
                        } @else if (procesandoEstadoId() === u.id) {
                          <span class="text-muted" style="font-size: 12px">Procesando…</span>
                        } @else {
                          <app-acciones-menu [acciones]="accionesDe(u)" />
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="ps-pie-tabla us-pie">
              <span>Mostrando {{ visibles().length }} de {{ filtrados().length }} usuarios</span>
              @if (visibles().length < filtrados().length) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="limite.set(limite() + porPagina)">Mostrar más</button>
              }
            </div>
          }
        </div>
      }
    </main>
  `,
})
export class UsuariosPage {
  protected readonly auth = inject(AuthService);
  protected readonly etiquetaRol = ETIQUETA_ROL;
  protected readonly rolesAsignables = ROLES_ASIGNABLES;
  protected readonly porPagina = POR_PAGINA;
  protected readonly rolesInternos = [
    { valor: 'gestor_humano', etiqueta: 'Gestión Humana', ayuda: 'Crea procesos y revisa postulaciones.' },
    { valor: 'admin', etiqueta: 'Administrador', ayuda: 'Además gestiona usuarios y ve la auditoría.' },
  ];
  protected readonly filtros: { valor: Filtro; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: 'Todos' },
    { valor: 'candidato', etiqueta: 'Candidatos' },
    { valor: 'gestor_humano', etiqueta: 'Gestión Humana' },
    { valor: 'admin', etiqueta: 'Administradores' },
    { valor: 'inactivos', etiqueta: 'Inactivas' },
  ];

  protected readonly usuarios = signal<any[] | null>(null);
  protected readonly error = signal('');
  protected readonly aviso = signal<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  protected readonly mostrarForm = signal(false);
  protected readonly form = signal({ ...FORM_VACIO });
  protected readonly errorForm = signal('');
  protected readonly creando = signal(false);
  protected readonly formCompleto = computed(() => {
    const f = this.form();
    return f.nombreCompleto.trim().length >= 3 && f.email.trim().length > 3 && f.password.length >= 8;
  });

  protected readonly cambiandoRolId = signal<string | null>(null);
  protected readonly editandoNombreId = signal<string | null>(null);
  protected readonly nombreEnEdicion = signal('');
  protected readonly guardandoNombre = signal(false);
  protected readonly editandoRolId = signal<string | null>(null);
  protected readonly busqueda = signal('');
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly limite = signal(POR_PAGINA);
  protected readonly procesandoEstadoId = signal<string | null>(null);

  protected readonly filtrados = computed(() => {
    const busqueda = this.busqueda().trim().toLowerCase();
    const f = this.filtro();
    return (this.usuarios() || [])
      .filter((u) => (f === 'todos' ? true : f === 'inactivos' ? !u.activo : u.rol === f))
      .filter((u) => !busqueda || `${u.nombreCompleto} ${u.email} ${u.cedula || ''}`.toLowerCase().includes(busqueda))
      // Cuentas internas primero; dentro de cada grupo, las más recientes arriba.
      .sort((a, b) => {
        const ia = a.rol === 'candidato' ? 1 : 0;
        const ib = b.rol === 'candidato' ? 1 : 0;
        if (ia !== ib) return ia - ib;
        return String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || ''));
      });
  });
  protected readonly visibles = computed(() => this.filtrados().slice(0, this.limite()));

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

  protected cuantos(f: Filtro): number {
    const lista = this.usuarios() || [];
    if (f === 'todos') return lista.length;
    if (f === 'inactivos') return lista.filter((u) => !u.activo).length;
    return lista.filter((u) => u.rol === f).length;
  }

  protected iniciales(nombre: string): string {
    const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '?';
  }

  protected fecha(valor: string | null | undefined): string {
    if (!valor) return '—';
    const f = new Date(valor);
    return isNaN(f.getTime()) ? '—' : FORMATO_FECHA.format(f);
  }

  protected abrirForm(): void {
    this.errorForm.set('');
    this.mostrarForm.set(true);
  }

  protected cerrarForm(): void {
    this.form.set({ ...FORM_VACIO });
    this.errorForm.set('');
    this.mostrarForm.set(false);
  }

  protected setForm(key: 'nombreCompleto' | 'email' | 'password', e: Event): void {
    const valor = (e.target as HTMLInputElement).value;
    this.form.update((f) => ({ ...f, [key]: valor }));
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

  private mostrarError(err: any, porDefecto: string): void {
    this.aviso.set({ tipo: 'error', texto: err instanceof ApiError ? err.detail : porDefecto });
  }

  protected async handleCrear(): Promise<void> {
    this.errorForm.set('');
    this.creando.set(true);
    try {
      const { nombreCompleto, rol } = this.form();
      await authApi.crearUsuarioInterno(this.form(), this.auth.token());
      this.cerrarForm();
      this.aviso.set({ tipo: 'ok', texto: `Se creó la cuenta de ${nombreCompleto.trim()} (${ETIQUETA_ROL[rol]}).` });
      await this.cargar();
    } catch (err: any) {
      this.errorForm.set(err instanceof ApiError ? err.detail : 'No se pudo crear la cuenta.');
    } finally {
      this.creando.set(false);
    }
  }

  protected async handleCambiarRol(u: any, nuevoRol: string): Promise<void> {
    if (nuevoRol === u.rol) {
      this.editandoRolId.set(null);
      return;
    }
    this.cambiandoRolId.set(u.id);
    try {
      await authApi.editarUsuario(u.id, { rol: nuevoRol }, this.auth.token());
      this.editandoRolId.set(null);
      this.aviso.set({ tipo: 'ok', texto: `${u.nombreCompleto} ahora tiene el rol ${ETIQUETA_ROL[nuevoRol]}.` });
      await this.cargar();
    } catch (err: any) {
      this.mostrarError(err, 'No se pudo cambiar el rol.');
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
      this.aviso.set({ tipo: 'error', texto: 'El nombre debe tener al menos 3 caracteres.' });
      return;
    }
    this.guardandoNombre.set(true);
    try {
      await authApi.editarUsuario(usuarioId, { nombreCompleto: this.nombreEnEdicion().trim() }, this.auth.token());
      this.editandoNombreId.set(null);
      await this.cargar();
    } catch (err: any) {
      this.mostrarError(err, 'No se pudo cambiar el nombre.');
    } finally {
      this.guardandoNombre.set(false);
    }
  }

  private async handleDesactivar(u: any): Promise<void> {
    if (!window.confirm(`¿Desactivar la cuenta de ${u.nombreCompleto}? No podrá iniciar sesión hasta que la reactives.`)) return;
    this.procesandoEstadoId.set(u.id);
    try {
      await authApi.desactivarCuentaDeOtro(u.id, this.auth.token());
      this.aviso.set({ tipo: 'ok', texto: `Se desactivó la cuenta de ${u.nombreCompleto}.` });
      await this.cargar();
    } catch (err: any) {
      this.mostrarError(err, 'No se pudo desactivar la cuenta.');
    } finally {
      this.procesandoEstadoId.set(null);
    }
  }

  private async handleReactivar(u: any): Promise<void> {
    this.procesandoEstadoId.set(u.id);
    try {
      await authApi.reactivarCuenta(u.id, this.auth.token());
      this.aviso.set({ tipo: 'ok', texto: `Se reactivó la cuenta de ${u.nombreCompleto}.` });
      await this.cargar();
    } catch (err: any) {
      this.mostrarError(err, 'No se pudo reactivar la cuenta.');
    } finally {
      this.procesandoEstadoId.set(null);
    }
  }
}
