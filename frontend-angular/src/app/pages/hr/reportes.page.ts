import { Component, computed, inject, signal } from '@angular/core';
import { DocHeader } from '../../components/doc-header';
import { Icon } from '../../shared/icon';
import { AuthService } from '../../core/auth.service';
import * as vacantesApi from '../../lib/api/vacantesApi';
import * as solicitudesApi from '../../lib/api/solicitudesApi';
import { formatearFecha } from '../../lib/formato';
import { CLASE_ESTADO, ETIQUETA_ESTADO } from './estados-vacante';

type Filtro = 'con' | 'todas' | 'sin';

/**
 * Reportes: descarga del formato GTH-FOR-04 (Resultados Cumplimiento de
 * Requisitos) por proceso de selección, con un resumen de las postulaciones.
 */
@Component({
  selector: 'app-reportes-page',
  imports: [DocHeader, Icon],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Reportes" />
    <main class="page">
      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      } @else if (!vacantes()) {
        <div class="ps-tarjeta cand-vacio"><p class="text-muted" style="margin: 0">Cargando reportes…</p></div>
      } @else {
        <div class="ps-encabezado">
          <div>
            <h2 class="ps-encabezado__titulo">Reportes de selección</h2>
            <p class="ps-encabezado__resumen">Descarga el formato GTH-FOR-04 de cada proceso con los resultados de cumplimiento de requisitos.</p>
          </div>
        </div>

        <dl class="ps-datos rp-resumen">
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Procesos con postulaciones</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ conPostulaciones() }}<span class="rp-de"> de {{ vacantes()!.length }}</span></dd>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Postulaciones recibidas</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ totalPostulaciones() }}</dd>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Sin revisar</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ porEstado()['Recibida'] || 0 }}</dd>
            <span class="ps-dato__sub">En estado "Recibida"</span>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Seleccionados</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ porEstado()['Aceptada'] || 0 }}</dd>
            <span class="ps-dato__sub">En estado "Aceptada"</span>
          </div>
        </dl>

        <div class="ps-tarjeta">
          <div class="ps-barra">
            <div class="ps-buscador">
              <span class="ps-buscador__icono" aria-hidden="true"><app-icon name="buscar" [size]="16" [strokeWidth]="2" /></span>
              <input type="search" aria-label="Buscar proceso" autocomplete="off" placeholder="Buscar por cargo o número de proceso…" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
            </div>
            <div class="ps-filtros" role="group" aria-label="Filtrar procesos">
              @for (f of filtros; track f.valor) {
                <button type="button" class="ps-chip" [class.is-activo]="filtro() === f.valor" [attr.aria-pressed]="filtro() === f.valor" (click)="filtro.set(f.valor)">
                  {{ f.etiqueta }} <span class="ps-chip__conteo">{{ cuantos(f.valor) }}</span>
                </button>
              }
            </div>
          </div>

          @if (filtradas().length === 0) {
            <div class="ps-vacio">
              <p style="margin: 0">
                {{ vacantes()!.length === 0 ? 'Aún no hay procesos de selección creados.' : filtro() === 'con' && !busqueda().trim() ? 'Todavía ningún proceso tiene postulaciones.' : 'Ningún proceso coincide con la búsqueda o el filtro.' }}
              </p>
              @if (vacantes()!.length > 0 && (busqueda().trim() || filtro() !== 'todas')) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="busqueda.set(''); filtro.set('todas')">Ver todos los procesos</button>
              }
            </div>
          } @else {
            <div style="overflow-x: auto">
              <table class="ps-tabla ps-tabla--vacantes rp-tabla">
                <thead>
                  <tr>
                    <th>Proceso</th>
                    <th>Estado</th>
                    <th class="ps-num">Postulaciones</th>
                    <th><span class="sr-only">Descargar</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of filtradas(); track v.id) {
                    <tr>
                      <td>
                        <span class="ps-aspirante">{{ v.cargo }}</span>
                        <div class="ps-meta">
                          <span class="ps-meta__codigo">{{ v.procesoNo }}</span>
                          @if (v.fechaCierre) {
                            <span class="ps-meta__item"><app-icon name="calendario" [size]="13" [strokeWidth]="2" />Cierre {{ fecha(v.fechaCierre) }}</span>
                          }
                        </div>
                      </td>
                      <td><span class="vac-status-pill {{ claseEstado[v.estado] || '' }}">{{ etiquetaEstado[v.estado] || v.estado }}</span></td>
                      <td class="ps-num">
                        <span class="ps-conteo" [class.is-cero]="!conteo()[v.id]">{{ conteo()[v.id] || 0 }}<span class="ps-solo-movil"> {{ (conteo()[v.id] || 0) === 1 ? 'postulación' : 'postulaciones' }}</span></span>
                      </td>
                      <td style="text-align: right; white-space: nowrap; width: 1%">
                        @if (conteo()[v.id] > 0) {
                          <button type="button" class="btn btn-secondary btn-sm" [disabled]="descargandoId() === v.id" (click)="descargar(v)" [attr.aria-label]="'Descargar reporte GTH-FOR-04 de ' + v.cargo">
                            <app-icon name="descargar" [size]="14" [strokeWidth]="2" />
                            {{ descargandoId() === v.id ? 'Generando…' : 'Descargar GTH-FOR-04' }}
                          </button>
                        } @else {
                          <span class="rp-sin">Sin postulaciones</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="ps-pie-tabla">Mostrando {{ filtradas().length }} de {{ vacantes()!.length }} procesos</div>
          }
        </div>
      }
    </main>
  `,
})
export class ReportesPage {
  private readonly auth = inject(AuthService);
  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  protected readonly claseEstado = CLASE_ESTADO;
  protected readonly fecha = formatearFecha;
  protected readonly vacantes = signal<any[] | null>(null);
  protected readonly conteo = signal<Record<string, number>>({});
  protected readonly porEstado = signal<Record<string, number>>({});
  protected readonly error = signal('');
  protected readonly busqueda = signal('');
  protected readonly filtro = signal<Filtro>('con');
  protected readonly descargandoId = signal<string | null>(null);
  protected readonly filtros: { valor: Filtro; etiqueta: string }[] = [
    { valor: 'con', etiqueta: 'Con postulaciones' },
    { valor: 'todas', etiqueta: 'Todos' },
    { valor: 'sin', etiqueta: 'Sin postulaciones' },
  ];

  protected readonly conPostulaciones = computed(() => (this.vacantes() || []).filter((v) => (this.conteo()[v.id] || 0) > 0).length);
  protected readonly totalPostulaciones = computed(() => (this.vacantes() || []).reduce((t, v) => t + (this.conteo()[v.id] || 0), 0));

  constructor() {
    const token = this.auth.token();
    Promise.all([vacantesApi.listarAdmin(token), solicitudesApi.conteoPorVacante(token)])
      .then(([listaVacantes, conteoPost]) => {
        this.conteo.set(conteoPost);
        this.vacantes.set(listaVacantes);
        // Si todavía no hay ninguna postulación, se muestran todos los procesos.
        if (!listaVacantes.some((v: any) => (conteoPost[v.id] || 0) > 0)) this.filtro.set('todas');
      })
      .catch(() => this.error.set('No se pudieron cargar los procesos de selección.'));

    // Resumen por estado de las postulaciones; si falla, las tarjetas quedan en 0.
    solicitudesApi
      .obtenerEstadisticas(token)
      .then((e: any) => this.porEstado.set(e?.porEstado || e?.por_estado || {}))
      .catch(() => {});
  }

  protected cuantos(f: Filtro): number {
    const lista = this.vacantes() || [];
    if (f === 'todas') return lista.length;
    const con = lista.filter((v) => (this.conteo()[v.id] || 0) > 0).length;
    return f === 'con' ? con : lista.length - con;
  }

  protected filtradas(): any[] {
    const busqueda = this.busqueda().trim().toLowerCase();
    const f = this.filtro();
    return (this.vacantes() || [])
      .filter((v) => {
        const n = this.conteo()[v.id] || 0;
        return f === 'todas' || (f === 'con' ? n > 0 : n === 0);
      })
      .filter((v) => !busqueda || `${v.cargo} ${v.procesoNo}`.toLowerCase().includes(busqueda))
      // Primero los que tienen postulaciones; dentro de cada grupo, el cierre más reciente arriba.
      .sort((a, b) => {
        const conA = (this.conteo()[a.id] || 0) > 0 ? 0 : 1;
        const conB = (this.conteo()[b.id] || 0) > 0 ? 0 : 1;
        if (conA !== conB) return conA - conB;
        return String(b.fechaCierre || '').localeCompare(String(a.fechaCierre || ''));
      });
  }

  protected async descargar(v: any): Promise<void> {
    this.descargandoId.set(v.id);
    try {
      await solicitudesApi.descargarReporte(v.id, `GTH-FOR-04_${v.procesoNo}.xlsx`, this.auth.token());
    } catch {
      alert('No se pudo descargar el reporte. Intenta de nuevo.');
    } finally {
      this.descargandoId.set(null);
    }
  }
}
