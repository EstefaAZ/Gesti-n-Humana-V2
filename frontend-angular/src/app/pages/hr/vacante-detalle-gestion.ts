import { Component, OnChanges, SimpleChanges, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EvaluacionBadge } from '../../components/evaluacion-badge';
import { Icon } from '../../shared/icon';
import { EstadoPostulacionBadge } from '../../components/estado-postulacion-badge';
import { Autofocus } from '../../shared/autofocus';
import { PostulacionDetalle } from './postulacion-detalle';
import { AuthService } from '../../core/auth.service';
import * as catalogosApi from '../../lib/api/catalogosApi';
import { NucleoNbc } from '../../lib/api/catalogosApi';
import { titulosAceptadosDe } from '../../lib/vacanteDefaults';
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
      <button type="button" class="btn btn-secondary btn-sm ps-volver" (click)="volver.emit()">
        <app-icon name="arrowLeft" [size]="14" [strokeWidth]="2" /> Volver a vacantes
      </button>

      <section class="ps-tarjeta ps-cabecera" aria-labelledby="titulo-vacante">
        <div class="ps-cabecera__fila">
          <div style="min-width: 0">
            <div class="ps-meta" style="margin-top: 0">
              <span class="ps-meta__codigo">{{ vacante().procesoNo }}</span>
              @if (vacante().area) {
                <span>{{ vacante().area }}</span>
              }
            </div>
            <h2 class="ps-cabecera__titulo" id="titulo-vacante">
              {{ vacante().cargo }}
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
                  title="Cambiar el estado"
                  [attr.aria-label]="'Estado: ' + etiquetaEstado[vacante().estado] + '. Cambiar estado'"
                >
                  {{ etiquetaEstado[vacante().estado] }}
                  <app-icon name="chevronAbajo" [size]="12" [strokeWidth]="2.4" />
                </button>
              }
            </h2>
          </div>
          <div class="ps-cabecera__acciones">
            <button type="button" class="btn btn-secondary btn-sm" (click)="editar.emit(vacante())">
              <app-icon name="lapiz" [size]="14" [strokeWidth]="2" /> Editar
            </button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="descargarReporte.emit(vacante())">
              <app-icon name="descargar" [size]="14" [strokeWidth]="2" /> Descargar reporte
            </button>
          </div>
        </div>

        @if (vacante().descripcion) {
          <p class="ps-cabecera__descripcion">{{ vacante().descripcion }}</p>
        }

        <dl class="ps-datos" style="margin-bottom: 0">
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Postulaciones</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ conteo()[vacante().id] || 0 }}</dd>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Cumplen criterios</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ postulaciones() ? cumplen() : '—' }}</dd>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Cierre</dt>
            <dd class="ps-dato__valor" style="margin: 0">
              {{ fecha(vacante().fechaCierre) || '—' }}
              @if (vacante().horaCierre) {
                <span class="ps-dato__sub">a las {{ vacante().horaCierre }}</span>
              }
            </dd>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Salario</dt>
            <dd class="ps-dato__valor" style="margin: 0">{{ vacante().salario ? '$ ' + vacante().salario : '—' }}</dd>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Sede</dt>
            <dd class="ps-dato__valor" style="margin: 0">{{ vacante().sede || '—' }}</dd>
          </div>
        </dl>

        <div class="ps-criterios">
          <h3 class="ps-subtitulo">Criterios de evaluación automática</h3>
          @if (c().nivelEducativoMin || titulos().length > 0 || c().experienciaMinAnios != null || c().idiomaRequerido || (c().certificacionesKeywords || []).length > 0) {
            <ul class="ps-etiquetas">
              @if (c().nivelEducativoMin) {
                <li class="ps-etiqueta">Estudios: <strong>{{ c().nivelEducativoMin }} o superior{{ c().graduadoRequerido ? ', graduado' : '' }}</strong></li>
              }
              @if (titulos().length > 0) {
                <li class="ps-etiqueta">Título en: <strong>{{ titulos().join(', ') }}{{ afines() }}</strong></li>
              }
              @if (c().experienciaMinAnios === 0) {
                <li class="ps-etiqueta">Experiencia: <strong>no exige experiencia previa</strong></li>
              } @else if (c().experienciaMinAnios) {
                <li class="ps-etiqueta">Experiencia: <strong>{{ c().experienciaMinAnios }} {{ c().experienciaMinAnios == 1 ? 'año' : 'años' }} mínimo</strong></li>
              }
              @if (c().idiomaRequerido) {
                <li class="ps-etiqueta">{{ c().idiomaRequerido }}: <strong>{{ nivelIdiomaMin() }} o superior</strong></li>
              }
              @for (cert of c().certificacionesKeywords || []; track $index) {
                <li class="ps-etiqueta">Certificación: <strong>{{ cert }}</strong></li>
              }
            </ul>
          } @else {
            <p class="ps-sin-criterios">Esta vacante no tiene criterios automáticos; todas las postulaciones se revisan manualmente.</p>
          }
        </div>
      </section>

      <section class="ps-tarjeta" aria-labelledby="titulo-candidatos">
        <div class="ps-candidatos__cabecera">
          <h3 class="ps-candidatos__titulo" id="titulo-candidatos">
            Candidatos postulados
            @if (postulaciones()) {
              <span class="ps-contador">{{ postulaciones()!.length }}</span>
            }
          </h3>
          @if (postulaciones() && postulaciones()!.length > 0) {
            <div class="ps-resumen">
              <span><span class="ps-punto ps-punto--publicada" aria-hidden="true"></span>{{ cumplen() }} cumple{{ cumplen() === 1 ? '' : 'n' }} criterios</span>
              <span><span class="ps-punto ps-punto--en_proceso" aria-hidden="true"></span>{{ noCumplen() }} no cumple{{ noCumplen() === 1 ? '' : 'n' }}</span>
            </div>
          }
        </div>

        @if (error()) {
          <div class="notice notice--danger" style="margin: 16px 18px">{{ error() }}</div>
        }

        @if (postulaciones() === null && !error()) {
          <p class="ps-vacio" style="margin: 0">Cargando…</p>
        }

        @if (postulaciones() && postulaciones()!.length === 0) {
          <p class="ps-vacio" style="margin: 0">Aún no hay postulaciones para esta vacante.</p>
        }

        @if (postulaciones() && postulaciones()!.length > 0) {
          <div style="overflow-x: auto">
            <table class="ps-tabla">
              <thead>
                <tr>
                  <th>Aspirante</th>
                  <th>Recibida</th>
                  <th>Estado</th>
                  <th>Evaluación</th>
                  <th><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (p of postulaciones(); track p.radicado) {
                  <tr>
                    <td class="ps-arriba">
                      <span class="ps-aspirante">{{ p.datosPersonales?.nombreCompleto }}</span>
                      <span class="ps-aspirante__cc">C.C. {{ p.datosPersonales?.cedula }}@if (p.datosPersonales?.celular) { · {{ p.datosPersonales?.celular }}}</span>
                    </td>
                    <td class="ps-arriba" style="white-space: nowrap">{{ fechaCorta(p.fechaSolicitud) }}</td>
                    <td class="ps-arriba"><app-estado-postulacion-badge [estado]="p.estado" /></td>
                    <td class="ps-arriba" style="min-width: 200px; max-width: 300px; white-space: normal"><app-evaluacion-badge [evaluacion]="p.evaluacion" /></td>
                    <td class="ps-arriba" style="text-align: right; white-space: nowrap; width: 1%">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="detalleId.set(p.radicado)">Ver detalles</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      @if (detalle(); as d) {
        <app-postulacion-detalle [solicitud]="d" (cerrar)="detalleId.set(null)" (cambioEstado)="cargarPostulaciones()" />
      }
    </div>
  `,
})
export class VacanteDetalleGestion implements OnChanges {
  protected readonly fecha = formatearFecha;
  private readonly auth = inject(AuthService);
  protected readonly nucleos = signal<NucleoNbc[]>([]);

  readonly vacante = input.required<any>();
  readonly conteo = input<Record<string, number>>({});
  readonly radicadoInicial = input<string | null>(null);
  readonly volver = output<void>();
  readonly cambiarEstado = output<{ vacante: any; estado: string }>();
  readonly descargarReporte = output<any>();
  readonly editar = output<any>();

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
    if (!this.nucleos().length) {
      // Nombres de los núcleos afines; si falla, se muestran sus códigos.
      catalogosApi.listarNucleos(this.auth.token()).then((n) => this.nucleos.set(n)).catch(() => {});
    }
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

  protected titulos(): string[] {
    return titulosAceptadosDe(this.c());
  }

  /** " o afines (Núcleo A; Núcleo B)" cuando la vacante acepta títulos afines. */
  protected afines(): string {
    const codigos: string[] = this.c().aceptaAfines ? this.c().nbcAfines || [] : [];
    if (!codigos.length) return '';
    const nombres = codigos.map((cod) => this.nucleos().find((n) => n.codigo === cod)?.nombre || `núcleo ${cod}`);
    return ` o afines (${nombres.join('; ')})`;
  }

  protected c(): any {
    return this.vacante().criterios || {};
  }

  protected nivelIdiomaMin(): string {
    return etiquetaNivelIdioma(normalizarNivelIdioma(this.c().idiomaNivelMin));
  }

  protected cumplen(): number {
    return (this.postulaciones() || []).filter((p) => p.evaluacion?.cumple === true).length;
  }

  protected noCumplen(): number {
    return (this.postulaciones() || []).filter((p) => p.evaluacion?.cumple === false).length;
  }

  protected fechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO');
  }

  protected onCambiarEstado(estado: string): void {
    this.cambiarEstado.emit({ vacante: this.vacante(), estado });
    this.editandoEstado.set(false);
  }
}
