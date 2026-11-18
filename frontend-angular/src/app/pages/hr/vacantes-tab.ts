import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { VacanteForm } from './vacante-form';
import { VacanteDetalleGestion } from './vacante-detalle-gestion';
import { AccionesMenu, Accion } from '../../components/acciones-menu';
import { Autofocus } from '../../shared/autofocus';
import { Icon } from '../../shared/icon';
import { AuthService } from '../../core/auth.service';
import * as vacantesApi from '../../lib/api/vacantesApi';
import * as solicitudesApi from '../../lib/api/solicitudesApi';
import { vacanteVacia } from '../../lib/vacanteDefaults';
import { CLASE_ESTADO, ETIQUETA_ESTADO, OPCIONES_ESTADO } from './estados-vacante';

const ESTADOS = ['publicada', 'en_proceso', 'cerrada', 'borrador', 'cancelada_desierta'];

import { formatearFecha } from '../../lib/formato';

@Component({
  selector: 'app-vacantes-tab',
  imports: [FormsModule, VacanteForm, VacanteDetalleGestion, AccionesMenu, Autofocus, Icon],
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
          (editar)="editar($event)"
        />
      } @else {
        <div class="empty-state">No se encontró la vacante.</div>
      }
    } @else {
      <div>
        @if (error()) {
          <div class="notice notice--danger">{{ error() }}</div>
        }

        <div class="ps-encabezado">
          <div>
            <h2 class="ps-encabezado__titulo">Vacantes</h2>
            <p class="ps-encabezado__resumen">
              <strong>{{ vacantes().length }}</strong> {{ vacantes().length === 1 ? 'vacante' : 'vacantes' }} ·
              <strong>{{ totalPostulaciones() }}</strong> {{ totalPostulaciones() === 1 ? 'postulación recibida' : 'postulaciones recibidas' }}
            </p>
          </div>
          <button type="button" class="btn btn-primary" (click)="nuevaVacante()">
            <app-icon name="mas" [size]="16" [strokeWidth]="2.2" /> Nueva vacante
          </button>
        </div>

        <div class="ps-tarjeta">
          <div class="ps-barra">
            <div class="ps-buscador">
              <span class="ps-buscador__icono" aria-hidden="true"><app-icon name="buscar" [size]="16" [strokeWidth]="2" /></span>
              <input
                type="search"
                aria-label="Buscar vacantes"
                autocomplete="off"
                placeholder="Buscar por cargo o número de proceso…"
                [value]="busqueda()"
                (input)="busqueda.set($any($event.target).value)"
              />
            </div>
            <div class="ps-filtros" role="group" aria-label="Filtrar por estado">
              <button type="button" class="ps-chip" [class.is-activo]="filtroEstado() === 'todas'" [attr.aria-pressed]="filtroEstado() === 'todas'" (click)="filtroEstado.set('todas')">
                Todas <span class="ps-chip__conteo">{{ vacantes().length }}</span>
              </button>
              @for (e of estados; track e) {
                <button
                  type="button"
                  class="ps-chip"
                  [class.is-activo]="filtroEstado() === e"
                  [class.is-vacio]="conteoPorEstado(e) === 0"
                  [attr.aria-pressed]="filtroEstado() === e"
                  (click)="filtroEstado.set(filtroEstado() === e ? 'todas' : e)"
                >
                  <span class="ps-punto ps-punto--{{ e }}" aria-hidden="true"></span>
                  {{ etiquetaEstado[e] }} <span class="ps-chip__conteo">{{ conteoPorEstado(e) }}</span>
                </button>
              }
            </div>
          </div>

          @if (filtradas().length === 0) {
            <div class="ps-vacio">
              @if (vacantes().length === 0) {
                <p style="margin: 0">Aún no hay vacantes creadas.</p>
                <button type="button" class="btn btn-secondary btn-sm" (click)="nuevaVacante()">Crear la primera vacante</button>
              } @else {
                <p style="margin: 0">Ninguna vacante coincide con la búsqueda o el filtro.</p>
                <button type="button" class="btn btn-secondary btn-sm" (click)="limpiarFiltros()">Quitar filtros</button>
              }
            </div>
          } @else {
            <div style="overflow-x: auto">
            <table class="ps-tabla ps-tabla--vacantes">
              <thead>
                <tr>
                  <th>Vacante</th>
                  <th>Cierre</th>
                  <th class="ps-num">Postulaciones</th>
                  <th>Estado</th>
                  <th><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (v of filtradas(); track v.id) {
                  <tr class="ps-fila" (click)="verDetalles(v)">
                    <td>
                      <button type="button" class="ps-cargo" (click)="$event.stopPropagation(); verDetalles(v)">{{ v.cargo }}</button>
                      <div class="ps-meta">
                        <span class="ps-meta__codigo">{{ v.procesoNo }}</span>
                        @if (v.sede) {
                          <span class="ps-meta__item"><app-icon name="ubicacion" [size]="13" [strokeWidth]="2" />{{ v.sede }}</span>
                        }
                        @if (v.fechaCreacion) {
                          <span class="ps-meta__item">Publicada {{ fechaCorta(v.fechaCreacion) }}</span>
                        }
                        @if (v.tieneDocumentoPdf) {
                          <span class="ps-meta__item" title="Tiene el PDF oficial adjunto"><app-icon name="documento" [size]="13" [strokeWidth]="2" />PDF</span>
                        }
                      </div>
                    </td>
                    <td class="ps-cierre">
                      @if (v.fechaCierre) {
                        {{ fecha(v.fechaCierre) }}<span class="ps-cierre__hora">{{ v.horaCierre || '' }}</span>
                        @if (avisoCierre(v); as aviso) {
                          <span class="ps-cierre__aviso">{{ aviso }}</span>
                        }
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                    <td class="ps-num"><span class="ps-conteo" [class.is-cero]="!conteo()[v.id]">{{ conteo()[v.id] || 0 }}<span class="ps-solo-movil"> {{ (conteo()[v.id] || 0) === 1 ? 'postulación' : 'postulaciones' }}</span></span></td>
                    <td (click)="$event.stopPropagation()">
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
                    <td (click)="$event.stopPropagation()" style="width: 1%">
                      <app-acciones-menu [acciones]="accionesDe(v)" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            </div>
            <div class="ps-pie-tabla">Mostrando {{ filtradas().length }} de {{ vacantes().length }} vacantes</div>
          }
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

  protected totalPostulaciones(): number {
    const conteo = this.conteo();
    return this.vacantes().reduce((total, v) => total + (conteo[v.id] || 0), 0);
  }

  protected limpiarFiltros(): void {
    this.filtroEstado.set('todas');
    this.busqueda.set('');
  }

  /** "Cierra hoy" / "Cierra en N días" para vacantes publicadas que cierran en menos de una semana. */
  protected avisoCierre(v: any): string | null {
    if (v.estado !== 'publicada' || !v.fechaCierre) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.fechaCierre);
    if (!m) return null;
    const [h, min] = String(v.horaCierre || '23:59').split(':').map(Number);
    const cierre = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h || 0, min || 0);
    const ahora = new Date();
    if (cierre <= ahora) return null;
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const diaCierre = new Date(cierre.getFullYear(), cierre.getMonth(), cierre.getDate());
    const dias = Math.round((diaCierre.getTime() - hoy.getTime()) / 86400000);
    if (dias > 7) return null;
    if (dias === 0) return 'Cierra hoy';
    return dias === 1 ? 'Cierra mañana' : `Cierra en ${dias} días`;
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
