import { Component, inject, signal } from '@angular/core';
import { DocHeader } from '../../components/doc-header';
import { AuthService } from '../../core/auth.service';
import * as vacantesApi from '../../lib/api/vacantesApi';
import * as solicitudesApi from '../../lib/api/solicitudesApi';
import { CLASE_ESTADO, ETIQUETA_ESTADO } from './estados-vacante';

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  selector: 'app-reportes-page',
  imports: [CampoAccesible, DocHeader],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Reportes" [showCode]="false" />
    @if (error()) {
      <main class="page"><div class="notice notice--danger">{{ error() }}</div></main>
    } @else if (!vacantes()) {
      <main class="page"><p class="text-muted">Cargando…</p></main>
    } @else {
      <main class="page">
        <div class="card">
          <div class="field" style="max-width: 320px; margin-bottom: 16px">
            <input type="search" aria-label="Buscar vacante" autocomplete="off" placeholder="Buscar vacante…" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
          </div>

          @if (filtradas().length === 0) {
            <div class="empty-state">{{ vacantes()!.length === 0 ? 'Aún no hay vacantes creadas.' : 'Ninguna vacante coincide con la búsqueda.' }}</div>
          } @else {
            <table class="plain-table">
              <thead>
                <tr><th>Vacante</th><th>Estado</th><th>Postulaciones</th><th><span class="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                @for (v of filtradas(); track v.id) {
                  <tr>
                    <td>
                      <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted)">{{ v.procesoNo }}</span>
                      <br />{{ v.cargo }}
                    </td>
                    <td><span class="vac-status-pill {{ claseEstado[v.estado] || '' }}">{{ etiquetaEstado[v.estado] || v.estado }}</span></td>
                    <td style="text-align: center; font-weight: 700">{{ conteo()[v.id] || 0 }}</td>
                    <td>
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        [disabled]="descargandoId() === v.id || !(conteo()[v.id] > 0)"
                        (click)="descargar(v)"
                        [title]="!(conteo()[v.id] > 0) ? 'Todavía no hay postulaciones para esta vacante' : ''"
                      >
                        {{ descargandoId() === v.id ? 'Descargando…' : 'Descargar reporte' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </main>
    }
  `,
})
export class ReportesPage {
  private readonly auth = inject(AuthService);
  protected readonly etiquetaEstado = ETIQUETA_ESTADO;
  protected readonly claseEstado = CLASE_ESTADO;
  protected readonly vacantes = signal<any[] | null>(null);
  protected readonly conteo = signal<Record<string, number>>({});
  protected readonly error = signal('');
  protected readonly busqueda = signal('');
  protected readonly descargandoId = signal<string | null>(null);

  constructor() {
    const token = this.auth.token();
    Promise.all([vacantesApi.listarAdmin(token), solicitudesApi.conteoPorVacante(token)])
      .then(([listaVacantes, conteoPost]) => {
        this.vacantes.set(listaVacantes);
        this.conteo.set(conteoPost);
      })
      .catch(() => this.error.set('No se pudieron cargar las vacantes.'));
  }

  protected filtradas(): any[] {
    const busqueda = this.busqueda();
    return (this.vacantes() || []).filter((v) => !busqueda.trim() || `${v.cargo} ${v.procesoNo}`.toLowerCase().includes(busqueda.toLowerCase()));
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
