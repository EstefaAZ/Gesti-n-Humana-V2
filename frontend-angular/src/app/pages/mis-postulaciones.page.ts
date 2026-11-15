import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocHeader } from '../components/doc-header';
import { EstadoPostulacionBadge } from '../components/estado-postulacion-badge';
import { AuthService } from '../core/auth.service';
import * as solicitudesApi from '../lib/api/solicitudesApi';

@Component({
  selector: 'app-mis-postulaciones-page',
  imports: [RouterLink, DocHeader, EstadoPostulacionBadge],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Mis postulaciones" />
    <main class="page">
      <div class="card">
        @if (error()) {
          <div class="notice notice--danger">{{ error() }}</div>
        }

        @if (postulaciones() === null && !error()) {
          <p class="text-muted">Cargando…</p>
        }

        @if (postulaciones() && postulaciones()!.length === 0) {
          <div class="empty-state">Aún no tienes postulaciones. <a routerLink="/">Ver vacantes abiertas</a>.</div>
        }

        @if (postulaciones() && postulaciones()!.length > 0) {
          <table class="plain-table">
            <thead>
              <tr><th>Vacante</th><th>Radicado</th><th>Estado</th><th><span class="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              @for (p of postulaciones(); track p.radicado) {
                <tr>
                  <td>{{ p.vacanteCargo || p.vacanteId }}</td>
                  <td class="mono" style="font-family: var(--font-mono); font-size: 12px">{{ p.radicado }}</td>
                  <td><app-estado-postulacion-badge [estado]="p.estado" /></td>
                  <td>
                    <button class="hr-link-btn" (click)="descargarPdf(p.radicado)">Descargar PDF</button>
                    @if (p.estado !== 'Retirada' && p.estado !== 'Aceptada') {
                      ·
                      <button class="hr-link-btn hr-link-btn--danger" (click)="retirarPostulacion(p.radicado)">Retirar postulación</button>
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
export class MisPostulacionesPage {
  private readonly auth = inject(AuthService);
  protected readonly postulaciones = signal<any[] | null>(null);
  protected readonly error = signal('');

  constructor() {
    // Nota: las notificaciones enlazan aquí con ?radicado=..., pero (igual que en
    // la versión React) esta página todavía no resalta ni desplaza hasta esa fila.
    solicitudesApi
      .misSolicitudes(this.auth.token())
      .then((p) => this.postulaciones.set(p))
      .catch(() => this.error.set('No se pudieron cargar tus postulaciones.'));
  }

  protected descargarPdf(radicado: string): void {
    solicitudesApi.descargarPdf(radicado, this.auth.token());
  }

  protected async retirarPostulacion(radicado: string): Promise<void> {
    if (!window.confirm('¿Retirarte de este proceso de selección? Tus datos se conservan, solo queda marcado que ya no sigues en el proceso.')) return;
    try {
      const actualizada = await solicitudesApi.retirar(radicado, this.auth.token());
      this.postulaciones.update((prev) => (prev || []).map((p) => (p.radicado === radicado ? actualizada : p)));
    } catch (e: any) {
      alert(e.detail || 'No se pudo retirar la postulación.');
    }
  }
}
