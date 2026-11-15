import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { VacanteForm } from './vacante-form';
import { VacanteDetalleGestion } from './vacante-detalle-gestion';
import { AccionesMenu, Accion } from '../../components/acciones-menu';
import { Autofocus } from '../../shared/autofocus';
import { AuthService } from '../../core/auth.service';
import * as vacantesApi from '../../lib/api/vacantesApi';
import * as solicitudesApi from '../../lib/api/solicitudesApi';
import { vacanteVacia } from '../../lib/vacanteDefaults';
import { CLASE_ESTADO, ETIQUETA_ESTADO, OPCIONES_ESTADO } from './estados-vacante';

const ESTADOS = ['publicada', 'en_proceso', 'cerrada', 'borrador', 'cancelada_desierta'];

import { formatearFecha } from '../../lib/formato';

@Component({
  selector: 'app-vacantes-tab',
  imports: [FormsModule, VacanteForm, VacanteDetalleGestion, AccionesMenu, Autofocus],
  host: { style: 'display: contents' },
  template: `
    @if (modo() === 'form') {
      <app-vacante-form [vacanteInicial]="vacanteEnEdicion()" [onGuardar]="guardar" [onCancelar]="cancelarForm" />
    } @else if (modo() === 'detalle') {
      @if (vacanteDetalle(); as vacante) {
        <app-vacante-detalle-gestion
          [vacante]="vacante"
          [conteo]="conteo()"
          [radicadoInicial]="vacanteEnUrl() === vacante.id ? radicadoEnUrl() : null"
          (volver)="volverALista()"
          (cambiarEstado)="cambiarEstado($event.vacante, $event.estado)"
          (descargarReporte)="descargarReporte($event)"
        />
      } @else {
        <div class="empty-state">No se encontró la vacante.</div>
      }
    } @else {
      <div>
        @if (error()) {
          <div class="notice notice--danger">{{ error() }}</div>
        }

        <div class="hr-table-actions" style="justify-content: flex-end; margin-bottom: 16px">
          <button type="button" class="btn btn-primary" (click)="nuevaVacante()">+ Nueva vacante</button>
        </div>

        <div class="stat-cards-grid stat-cards-grid--compact" style="margin-bottom: 20px">
          @for (e of estados; track e) {
            <button
              type="button"
              class="stat-card"
              style="text-align: left; cursor: pointer"
              [style.border]="filtroEstado() === e ? '2px solid var(--color-primary)' : null"
              [attr.aria-pressed]="filtroEstado() === e"
              (click)="filtroEstado.set(filtroEstado() === e ? 'todas' : e)"
            >
              <div class="stat-card__value">{{ conteoPorEstado(e) }}</div>
              <div class="stat-card__label">{{ etiquetaEstado[e] }}</div>
            </button>
          }
        </div>

        <div class="card">
          <div class="hr-table-actions" style="margin-bottom: 16px">
            <input
              type="search"
              aria-label="Buscar vacantes"
              autocomplete="off"
              placeholder="Buscar por cargo o Proceso de Selección No.…"
              [value]="busqueda()"
              (input)="busqueda.set($any($event.target).value)"
              style="max-width: 320px"
            />
            @if (filtroEstado() !== 'todas') {
              <button type="button" class="hr-link-btn" (click)="filtroEstado.set('todas')">Quitar filtro ({{ etiquetaEstado[filtroEstado()] }}) ✕</button>
            }
          </div>

          @if (filtradas().length === 0) {
            <div class="empty-state">{{ vacantes().length === 0 ? 'Aún no hay vacantes creadas.' : 'Ninguna vacante coincide con el filtro.' }}</div>
          } @else {
            <table class="plain-table">
              <thead>
                <tr>
                  <th>Vacante</th>
                  <th>Fecha cierre</th>
                  <th>Postulaciones</th>
                  <th>Fecha publicación</th>
                  <th>Estado</th>
                  <th><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (v of filtradas(); track v.id) {
                  <tr>
                    <td>
                      <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted)">{{ v.procesoNo }}</span>
                      <br />
                      <button type="button" class="hr-link-btn" style="font-size: 14px; font-weight: 600; padding: 0" (click)="verDetalles(v)">
                        {{ v.cargo }}
                      </button>
                      @if (v.tieneDocumentoPdf) {
                        <span title="Tiene PDF adjunto" style="margin-left: 6px; font-size: 12px">📄</span>
                      }
                    </td>
                    <td>{{ fecha(v.fechaCierre) || '—' }} {{ v.horaCierre || '' }}</td>
                    <td style="text-align: center; font-weight: 700">{{ conteo()[v.id] || 0 }}</td>
                    <td>{{ v.fechaCreacion ? fechaCorta(v.fechaCreacion) : '—' }}</td>
                    <td>
                      @if (editandoEstadoId() === v.id) {
                        <select
                          appAutofocus
                          [ngModel]="v.estado"
                          (ngModelChange)="cambiarEstado(v, $event)"
                          (blur)="editandoEstadoId.set(null)"
                          class="vac-status-select"
                          aria-label="Estado de la vacante"
                        >
                          @for (op of opcionesEstado; track op[0]) {
                            <option [value]="op[0]">{{ op[1] }}</option>
                          }
                        </select>
                      } @else {
                        <span class="vac-status-pill {{ claseEstado[v.estado] || '' }}">{{ etiquetaEstado[v.estado] }}</span>
                      }
                    </td>
                    <td>
                      <app-acciones-menu [acciones]="accionesDe(v)" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
          <p class="text-muted" style="font-size: 12px; margin-top: 12px">Mostrando {{ filtradas().length }} de {{ vacantes().length }} vacantes</p>
        </div>
      </div>
    }
  `,
})
export class VacantesTab {
  protected readonly fecha = formatearFecha;
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly estados = ESTADOS;
  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  protected readonly claseEstado = CLASE_ESTADO;
  protected readonly opcionesEstado = OPCIONES_ESTADO;

  private readonly queryParams = toSignal(this.route.queryParamMap);
  protected readonly vacanteEnUrl = () => this.queryParams()?.get('vacante') ?? null;
  protected readonly radicadoEnUrl = () => this.queryParams()?.get('radicado') ?? null;
  private yaAbriDesdeUrl = false;

  protected readonly vacantes = signal<any[]>([]);
  protected readonly conteo = signal<Record<string, number>>({});
  protected readonly modo = signal<'lista' | 'form' | 'detalle'>('lista');
  protected readonly vacanteEnEdicion = signal<any>(null);
  protected readonly vacanteDetalleId = signal<string | null>(null);
  protected readonly enlaceCopiadoId = signal<string | null>(null);
  protected readonly editandoEstadoId = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly filtroEstado = signal('todas');
  protected readonly busqueda = signal('');

  constructor() {
    this.recargar();

    // Se abre una sola vez por llegada: después el usuario manda, y una recarga
    // de la lista no lo devuelve al detalle contra su voluntad.
    effect(() => {
      const vacanteEnUrl = this.vacanteEnUrl();
      const vacantes = this.vacantes();
      if (this.yaAbriDesdeUrl || !vacanteEnUrl || vacantes.length === 0) return;
      this.yaAbriDesdeUrl = true;
      if (!vacantes.some((v) => v.id === vacanteEnUrl)) return;
      this.vacanteDetalleId.set(vacanteEnUrl);
      this.modo.set('detalle');
    });
  }

  private async recargar(): Promise<void> {
    try {
      const token = this.auth.token();
      const [listaVacantes, conteoPost] = await Promise.all([vacantesApi.listarAdmin(token), solicitudesApi.conteoPorVacante(token)]);
      this.vacantes.set(listaVacantes);
      this.conteo.set(conteoPost);
    } catch {
      this.error.set('No se pudieron cargar las vacantes.');
    }
  }

  protected vacanteDetalle(): any {
    return this.vacantes().find((v) => v.id === this.vacanteDetalleId());
  }

  protected conteoPorEstado(e: string): number {
    return this.vacantes().filter((v) => v.estado === e).length;
  }

  protected filtradas(): any[] {
    const filtro = this.filtroEstado();
    const busqueda = this.busqueda();
    return this.vacantes()
      .filter((v) => filtro === 'todas' || v.estado === filtro)
      .filter((v) => !busqueda.trim() || `${v.cargo} ${v.procesoNo}`.toLowerCase().includes(busqueda.toLowerCase()));
  }

  protected fechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO');
  }

  protected accionesDe(v: any): Accion[] {
    return [
      { etiqueta: 'Ver detalles', onClick: () => this.verDetalles(v) },
      { etiqueta: 'Cambiar estado', onClick: () => this.editandoEstadoId.set(v.id) },
      { etiqueta: 'Editar', onClick: () => this.editar(v) },
      { etiqueta: this.enlaceCopiadoId() === v.id ? '¡Copiado!' : 'Copiar enlace', onClick: () => this.copiarEnlace(v) },
      { etiqueta: 'Eliminar', onClick: () => this.eliminar(v.id), danger: true },
    ];
  }

  protected volverALista(): void {
    this.vacanteDetalleId.set(null);
    this.modo.set('lista');
    if (this.vacanteEnUrl() || this.radicadoEnUrl()) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  protected nuevaVacante(): void {
    this.vacanteEnEdicion.set(vacanteVacia());
    this.modo.set('form');
  }

  protected editar(v: any): void {
    this.vacanteEnEdicion.set({ ...v, _editando: true });
    this.modo.set('form');
  }

  protected verDetalles(v: any): void {
    this.vacanteDetalleId.set(v.id);
    this.modo.set('detalle');
  }

  protected readonly cancelarForm = () => this.modo.set(this.vacanteDetalleId() ? 'detalle' : 'lista');

  protected readonly guardar = async (v: any, pdfFile: File | null): Promise<void> => {
    const token = this.auth.token();
    let guardada;
    if (v._editando) {
      guardada = await vacantesApi.actualizar(v.id, v, token);
    } else {
      guardada = await vacantesApi.crear(v, token);
    }
    if (pdfFile) {
      try {
        await vacantesApi.subirDocumentoPdf(guardada.id, pdfFile, token);
      } catch {
        alert('La vacante se guardó, pero el PDF no se pudo subir. Intenta subirlo de nuevo editando la vacante.');
      }
    }
    await this.recargar();
    this.modo.set(this.vacanteDetalleId() ? 'detalle' : 'lista');
  };

  protected async cambiarEstado(v: any, nuevoEstado: string): Promise<void> {
    await vacantesApi.cambiarEstado(v.id, nuevoEstado, this.auth.token());
    this.editandoEstadoId.set(null);
    await this.recargar();
  }

  protected async eliminar(id: string): Promise<void> {
    if (!window.confirm('¿Eliminar esta vacante? Las postulaciones ya recibidas se conservan.')) return;
    await vacantesApi.eliminar(id, this.auth.token());
    if (this.vacanteDetalleId() === id) {
      this.vacanteDetalleId.set(null);
      this.modo.set('lista');
    }
    await this.recargar();
  }

  protected async copiarEnlace(v: any): Promise<void> {
    const url = `${window.location.origin}/postularme/${v.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copia el enlace:', url);
    }
    this.enlaceCopiadoId.set(v.id);
    setTimeout(() => this.enlaceCopiadoId.set(null), 2000);
  }

  protected async descargarReporte(v: any): Promise<void> {
    try {
      await solicitudesApi.descargarReporte(v.id, `GTH-FOR-04_${v.procesoNo}.xlsx`, this.auth.token());
    } catch {
      alert('No se pudo descargar el reporte. Intenta de nuevo.');
    }
  }
}
