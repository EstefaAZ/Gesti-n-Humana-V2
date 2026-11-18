import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocHeader } from '../../components/doc-header';
import { AuthService } from '../../core/auth.service';
import * as authApi from '../../lib/api/authApi';
import * as vacantesApi from '../../lib/api/vacantesApi';
import * as solicitudesApi from '../../lib/api/solicitudesApi';

const ETIQUETA_MODULO: Record<string, string> = { login: 'Login', vacantes: 'Vacantes', candidatos: 'Candidatos' };
// Tonos de verde distinguibles y legibles sobre blanco (mínimo 4,5:1).
const COLOR_MODULO: Record<string, string> = { login: '#0A7A30', vacantes: '#3B6E1E', candidatos: '#004D20' };

function formatearFecha(fechaISO: string | null | undefined): string {
  if (!fechaISO) return '';
  const f = new Date(fechaISO);
  return f.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

@Component({
  selector: 'app-auditoria-page',
  imports: [FormsModule, DocHeader],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Auditoría" />
    <main class="page" style="max-width: 1000px">
      <p class="section-intro" style="margin-top: -8px">Registro de quién hizo qué y cuándo. Se muestran los últimos 100 eventos de cada uno.</p>

      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      }

      <div class="card">
        <div class="hr-table-actions" style="margin-bottom: 16px">
          <input
            type="search"
            aria-label="Buscar en la descripción"
            autocomplete="off"
            placeholder="Buscar en la descripción…"
            [value]="busqueda()"
            (input)="busqueda.set($any($event.target).value)"
            style="max-width: 280px"
          />
          <select aria-label="Filtrar por módulo" [ngModel]="filtroModulo()" (ngModelChange)="filtroModulo.set($event)" style="max-width: 180px">
            <option value="todos">Todos los módulos</option>
            <option value="login">Login</option>
            <option value="vacantes">Vacantes</option>
            <option value="candidatos">Candidatos</option>
          </select>
        </div>

        @if (eventos() === null) {
          <p class="text-muted">Cargando…</p>
        } @else if (filtrados().length === 0) {
          <p class="text-muted">No hay eventos que coincidan.</p>
        } @else {
          <table class="plain-table">
            <thead>
              <tr><th>Fecha</th><th>Módulo</th><th>Evento</th><th>Actor</th></tr>
            </thead>
            <tbody>
              @for (e of filtrados(); track e.modulo + '-' + e.id) {
                <tr>
                  <td style="white-space: nowrap; font-size: 12.5px">{{ formatearFecha(e.fecha) }}</td>
                  <td>
                    <span style="font-size: 11px; font-weight: 600; text-transform: uppercase" [style.color]="colorModulo[e.modulo]">
                      {{ etiquetaModulo[e.modulo] }}
                    </span>
                  </td>
                  <td style="font-size: 13px">{{ e.descripcion }}</td>
                  <td style="font-size: 12.5px" class="text-muted">{{ e.actorNombre || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </main>
  `,
})
export class AuditoriaPage {
  private readonly auth = inject(AuthService);
  protected readonly etiquetaModulo = ETIQUETA_MODULO;
  protected readonly colorModulo = COLOR_MODULO;
  protected readonly formatearFecha = formatearFecha;
  protected readonly eventos = signal<any[] | null>(null);
  protected readonly error = signal('');
  protected readonly filtroModulo = signal('todos');
  protected readonly busqueda = signal('');

  constructor() {
    const token = this.auth.token();
    Promise.all([authApi.obtenerAuditoria(token, 100), vacantesApi.obtenerAuditoria(token, 100), solicitudesApi.obtenerAuditoria(token, 100)])
      .then(([login, vacantes, candidatos]) => {
        const combinados = [
          ...login.map((e: any) => ({ ...e, modulo: 'login' })),
          ...vacantes.map((e: any) => ({ ...e, modulo: 'vacantes' })),
          ...candidatos.map((e: any) => ({ ...e, modulo: 'candidatos' })),
        ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        this.eventos.set(combinados);
      })
      .catch(() => this.error.set('No se pudo cargar la auditoría. Verifica que los 3 backends estén corriendo.'));
  }

  protected filtrados(): any[] {
    const filtro = this.filtroModulo();
    const busqueda = this.busqueda();
    return (this.eventos() || []).filter((e) => {
      if (filtro !== 'todos' && e.modulo !== filtro) return false;
      if (busqueda && !e.descripcion.toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });
  }
}
