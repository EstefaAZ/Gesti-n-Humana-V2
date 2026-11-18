import { Component, OnChanges, SimpleChanges, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EvaluacionBadge } from '../../components/evaluacion-badge';
import { Icon } from '../../shared/icon';
import { EstadoPostulacionBadge } from '../../components/estado-postulacion-badge';
import { Autofocus } from '../../shared/autofocus';
import { PostulacionDetalle } from './postulacion-detalle';
import { AuthService } from '../../core/auth.service';
import { etiquetaNivelIdioma, normalizarNivelIdioma } from '../../data/catalogos';
import * as solicitudesApi from '../../lib/api/solicitudesApi';
import { CLASE_ESTADO, ETIQUETA_ESTADO, OPCIONES_ESTADO } from './estados-vacante';


import { formatearFecha } from '../../lib/formato';

@Component({
  selector: 'app-vacante-detalle-gestion',
  imports: [FormsModule, EvaluacionBadge, EstadoPostulacionBadge, Autofocus, PostulacionDetalle, Icon],
  host: { style: 'display: contents' },
  template: `
    <div>
      <button type="button" class="btn btn-secondary btn-sm" (click)="volver.emit()" style="margin-bottom: 16px">
        <app-icon name="arrowLeft" [size]="15" [strokeWidth]="2" /> Volver a vacantes
      </button>

      <div class="card" style="margin-bottom: 20px">
        <div class="hr-table-actions" style="justify-content: space-between; align-items: flex-start; margin-bottom: 12px">
          <div>
            <span style="font-family: var(--font-mono); font-size: 12px; color: var(--color-text-muted)">{{ vacante().procesoNo }}</span>
            <h2 class="section-title" style="margin: 2px 0 0">{{ vacante().cargo }}</h2>
          </div>
          @if (editandoEstado()) {
            <select
              appAutofocus
              [ngModel]="vacante().estado"
              (ngModelChange)="onCambiarEstado($event)"
              (blur)="editandoEstado.set(false)"
              class="vac-status-select"
              aria-label="Estado de la vacante"
            >
              @for (op of opcionesEstado; track op[0]) {
                <option [value]="op[0]">{{ op[1] }}</option>
              }
            </select>
          } @else {
            <button
              type="button"
              class="vac-status-pill {{ claseEstado[vacante().estado] || '' }}"
              (click)="editandoEstado.set(true)"
              title="Clic para cambiar el estado"
              [attr.aria-label]="'Estado: ' + etiquetaEstado[vacante().estado] + '. Cambiar estado'"
            >
              {{ etiquetaEstado[vacante().estado] }}
            </button>
          }
        </div>

        @if (vacante().descripcion) {
          <p class="text-muted" style="font-size: 13.5px; margin-bottom: 14px">{{ vacante().descripcion }}</p>
        }

        <div class="field-grid" style="margin-bottom: 14px">
          <div class="info-box"><label>Sede</label><div class="value">{{ vacante().sede || '—' }}</div></div>
          <div class="info-box"><label>Salario</label><div class="value">{{ vacante().salario || '—' }}</div></div>
          <div class="info-box"><label>Cierre</label><div class="value">{{ fecha(vacante().fechaCierre) || '—' }} {{ vacante().horaCierre || '' }}</div></div>
          <div class="info-box"><label>Postulaciones</label><div class="value">{{ conteo()[vacante().id] || 0 }}</div></div>
        </div>

        @if (c().nivelEducativoMin || c().experienciaMinAnios || c().idiomaRequerido || (c().certificacionesKeywords || []).length > 0) {
          <ul style="margin: 0 0 14px 18px; padding: 0; font-size: 12.5px; color: var(--color-text-muted)">
            @if (c().nivelEducativoMin) {
              <li>Nivel educativo mínimo: {{ c().nivelEducativoMin }} o superior{{ c().graduadoRequerido ? ' (graduado)' : '' }}</li>
            }
            @if (c().experienciaMinAnios) {
              <li>Experiencia mínima: {{ c().experienciaMinAnios }} años</li>
            }
            @if (c().idiomaRequerido) {
              <li>Idioma: {{ c().idiomaRequerido }} — nivel mínimo {{ nivelIdiomaMin() }} o superior</li>
            }
            @for (cert of c().certificacionesKeywords || []; track $index) {
              <li>Certificación: "{{ cert }}"</li>
            }
          </ul>
        }

        <div class="hr-table-actions">
          <button type="button" class="btn btn-secondary btn-sm" (click)="descargarReporte.emit(vacante())">Descargar reporte</button>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title" style="font-size: 15px; margin-bottom: 14px">Candidatos postulados</h3>
        @if (error()) {
          <div class="notice notice--danger">{{ error() }}</div>
        }

        @if (postulaciones() === null && !error()) {
          <p class="text-muted">Cargando…</p>
        }

        @if (postulaciones() && postulaciones()!.length === 0) {
          <div class="empty-state">Aún no hay postulaciones para esta vacante.</div>
        }

        @if (postulaciones() && postulaciones()!.length > 0) {
          <table class="plain-table">
            <colgroup>
              <col style="width: 22%" />
              <col style="width: 12%" />
              <col style="width: 12%" />
              <col style="width: 10%" />
              <col style="width: 31%" />
              <col style="width: 13%" />
            </colgroup>
            <thead>
              <tr>
                <th>Aspirante</th>
                <th>Celular</th>
                <th>Recibido</th>
                <th>Estado</th>
                <th style="max-width: 220px">Evaluación</th>
                <th><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (p of postulaciones(); track p.radicado) {
                <tr>
                  <td style="white-space: nowrap">
                    {{ p.datosPersonales?.nombreCompleto }}
                    <br /><span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted)">C.C. {{ p.datosPersonales?.cedula }}</span>
                  </td>
                  <td>{{ p.datosPersonales?.celular }}</td>
                  <td>{{ fechaCorta(p.fechaSolicitud) }}</td>
                  <td><app-estado-postulacion-badge [estado]="p.estado" /></td>
                  <td style="max-width: 220px; white-space: normal"><app-evaluacion-badge [evaluacion]="p.evaluacion" /></td>
                  <td style="text-align: right; white-space: nowrap">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="detalleId.set(p.radicado)">Ver detalles</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      @if (detalle(); as d) {
        <app-postulacion-detalle [solicitud]="d" (cerrar)="detalleId.set(null)" (cambioEstado)="cargarPostulaciones()" />
      }
    </div>
  `,
})
export class VacanteDetalleGestion implements OnChanges {
  protected readonly fecha = formatearFecha;
  private readonly auth = inject(AuthService);

  readonly vacante = input.required<any>();
  readonly conteo = input<Record<string, number>>({});
  readonly radicadoInicial = input<string | null>(null);
  readonly volver = output<void>();
  readonly cambiarEstado = output<{ vacante: any; estado: string }>();
  readonly descargarReporte = output<any>();

  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  protected readonly claseEstado = CLASE_ESTADO;
  protected readonly opcionesEstado = OPCIONES_ESTADO;

  protected readonly postulaciones = signal<any[] | null>(null);
  // `radicadoInicial` llega cuando se entró desde una notificación: abre de una
  // vez el detalle de esa postulación. Si el radicado ya no existe, no pasa nada.
  protected readonly detalleId = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly editandoEstado = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['radicadoInicial']?.firstChange) {
      this.detalleId.set(this.radicadoInicial() || null);
    }
    const chVacante = changes['vacante'];
    if (chVacante && (chVacante.firstChange || chVacante.previousValue?.id !== chVacante.currentValue?.id)) {
      this.cargarPostulaciones();
    }
  }

  protected cargarPostulaciones(): void {
    solicitudesApi
      .listarPorVacante(this.vacante().id, this.auth.token())
      .then((lista) => {
        lista.sort((a: any, b: any) => (a.evaluacion?.cumple ? 0 : 1) - (b.evaluacion?.cumple ? 0 : 1));
        this.postulaciones.set(lista);
      })
      .catch(() => this.error.set('No se pudieron cargar las postulaciones.'));
  }

  protected detalle(): any {
    return (this.postulaciones() || []).find((p) => p.radicado === this.detalleId());
  }

  protected c(): any {
    return this.vacante().criterios || {};
  }

  protected nivelIdiomaMin(): string {
    return etiquetaNivelIdioma(normalizarNivelIdioma(this.c().idiomaNivelMin));
  }

  protected fechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO');
  }

  protected onCambiarEstado(estado: string): void {
    this.cambiarEstado.emit({ vacante: this.vacante(), estado });
    this.editandoEstado.set(false);
  }
}
