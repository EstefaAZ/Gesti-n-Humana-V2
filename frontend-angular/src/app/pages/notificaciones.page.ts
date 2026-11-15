import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DocHeader } from '../components/doc-header';
import { ICONO_POR_TIPO } from '../components/notification-bell';
import { AuthService } from '../core/auth.service';
import * as notificacionesApi from '../lib/api/notificacionesApi';

function formatearFecha(fechaISO: string | null | undefined): string {
  if (!fechaISO) return '';
  return new Date(fechaISO).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

@Component({
  selector: 'app-notificaciones-page',
  imports: [DocHeader],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Notificaciones" [showCode]="false" />
    <main class="page">
      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      }

      <div class="card">
        <div class="hr-table-actions" style="justify-content: space-between; margin-bottom: 16px">
          <h2 class="section-title" style="margin: 0">Todas tus notificaciones</h2>
          @if (hayNoLeidas()) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="marcarTodas()">Marcar todas leídas</button>
          }
        </div>

        @if (notificaciones() === null) {
          <p class="text-muted">Cargando…</p>
        } @else if (notificaciones()!.length === 0) {
          <div class="empty-state">Todavía no tienes notificaciones.</div>
        } @else {
          <ul style="list-style: none; margin: 0; padding: 0">
            @for (n of notificaciones(); track n.servicio + '-' + n.id) {
              <li>
                <button type="button" class="notif-lista__item" [class.is-unread]="!n.leida" (click)="abrirNotificacion(n)">
                  <span style="font-size: 20px; flex-shrink: 0" aria-hidden="true">{{ iconos[n.tipo] || '🔔' }}</span>
                  <span style="flex: 1">
                    <span style="display: block; font-size: 14px; font-weight: 700; color: var(--color-text)">{{ n.titulo }}</span>
                    <span style="display: block; font-size: 13px; color: var(--color-text-muted); margin-top: 2px">{{ n.mensaje }}</span>
                    <span style="display: block; font-size: 11.5px; color: var(--color-text-muted); margin-top: 6px">{{ formatearFecha(n.fechaCreacion) }}</span>
                  </span>
                  @if (!n.leida) {
                    <span class="estado-badge estado-badge--preseleccionado" style="height: fit-content">Nueva</span>
                  }
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </main>
  `,
})
export class NotificacionesPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly notificaciones = signal<any[] | null>(null);
  protected readonly error = signal('');
  protected readonly iconos = ICONO_POR_TIPO;
  protected readonly formatearFecha = formatearFecha;

  constructor() {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.notificaciones.set(await notificacionesApi.listarTodas(this.auth.token()));
    } catch {
      this.error.set('No se pudieron cargar tus notificaciones.');
    }
  }

  protected hayNoLeidas(): boolean {
    return (this.notificaciones() || []).some((n) => !n.leida);
  }

  private async marcarLeida(n: any): Promise<void> {
    if (n.leida) return;
    try {
      await notificacionesApi.marcarLeida(n, this.auth.token());
      this.notificaciones.update((prev) =>
        (prev || []).map((x) => (x.id === n.id && x.servicio === n.servicio ? { ...x, leida: true } : x)),
      );
    } catch {
      // no bloquea la interfaz
    }
  }

  protected async marcarTodas(): Promise<void> {
    try {
      await notificacionesApi.marcarTodasLeidas(this.auth.token());
      this.notificaciones.update((prev) => (prev || []).map((x) => ({ ...x, leida: true })));
    } catch {
      // no bloquea la interfaz
    }
  }

  /** Marca como leída (comportamiento de siempre) y lleva al recurso relacionado. */
  protected async abrirNotificacion(n: any): Promise<void> {
    await this.marcarLeida(n);
    const destino = await notificacionesApi.resolverDestino(n, this.auth.token()).catch(() => null);
    if (destino) this.router.navigateByUrl(destino);
  }

}
