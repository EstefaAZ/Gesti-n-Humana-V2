import { Component, ElementRef, HostListener, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import * as notificacionesApi from '../lib/api/notificacionesApi';

export const ICONO_POR_TIPO: Record<string, string> = {
  cuenta_desactivada: '🔒',
  cuenta_reactivada: '🔓',
  solicitud_creada: '📩',
  estado_cambiado: '🔔',
  nueva_postulacion: '🧑‍💼',
};

export function tiempoRelativo(fechaISO: string | null | undefined): string {
  if (!fechaISO) return '';
  const diffMs = Date.now() - new Date(fechaISO).getTime();
  const horas = Math.floor(diffMs / 3600000);
  if (horas < 1) return 'Hace unos minutos';
  if (horas < 24) return `Hace ${horas} hora${horas === 1 ? '' : 's'}`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
}

@Component({
  selector: 'app-notification-bell',
  host: { style: 'display: contents' },
  template: `
    @if (auth.autenticado()) {
      <div class="notif-bell" #contenedor>
        <button
          type="button"
          class="notif-bell__boton"
          (click)="abrirPanel()"
          [attr.aria-label]="conteo() > 0 ? 'Notificaciones, ' + (conteo() > 9 ? '9+' : conteo()) + ' sin leer' : 'Notificaciones'"
          [attr.aria-expanded]="abierto()"
        >
          <span aria-hidden="true">🔔</span>
          @if (conteo() > 0) {
            <span class="notif-bell__badge" aria-hidden="true">{{ conteo() > 9 ? '9+' : conteo() }}</span>
          }
        </button>

        @if (abierto()) {
          <div class="notif-bell__panel" role="dialog" aria-label="Notificaciones recientes">
            <div class="notif-bell__header">
              <span>Notificaciones</span>
              @if (conteo() > 0) {
                <button type="button" class="hr-link-btn" (click)="marcarTodas()">Marcar todas leídas</button>
              }
            </div>

            @if (notificaciones() === null) {
              <p class="text-muted" style="font-size: 12.5px; padding: 12px 16px">Cargando…</p>
            } @else if (recientes().length === 0) {
              <p class="text-muted" style="font-size: 12.5px; padding: 12px 16px">No tienes notificaciones todavía.</p>
            } @else {
              <ul class="notif-bell__lista">
                @for (n of recientes(); track n.servicio + '-' + n.id) {
                  <li>
                    <button type="button" class="notif-bell__item" [class.is-unread]="!n.leida" (click)="abrirNotificacion(n)">
                      <span class="notif-bell__icono" aria-hidden="true">{{ iconos[n.tipo] || '🔔' }}</span>
                      <span>
                        <span class="notif-bell__titulo" style="display: block">
                          @if (!n.leida) {
                            <span class="sr-only">No leída: </span>
                          }
                          {{ n.titulo }}
                        </span>
                        <span class="notif-bell__mensaje" style="display: block">{{ n.mensaje }}</span>
                        <span class="notif-bell__fecha" style="display: block">{{ tiempoRelativo(n.fechaCreacion) }}</span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            }

            <button type="button" class="notif-bell__vertodas" (click)="verTodas()">Ver todas</button>
          </div>
        }
      </div>
    }
  `,
})
export class NotificationBell implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly abierto = signal(false);
  protected readonly conteo = signal(0);
  protected readonly notificaciones = signal<any[] | null>(null);
  protected readonly iconos = ICONO_POR_TIPO;
  protected readonly tiempoRelativo = tiempoRelativo;
  private readonly contenedor = viewChild<ElementRef<HTMLElement>>('contenedor');
  private intervalo: any = null;

  protected recientes(): any[] {
    return (this.notificaciones() || []).slice(0, 8);
  }

  ngOnInit(): void {
    if (!this.auth.autenticado()) return;
    this.cargarConteo();
    this.intervalo = setInterval(() => this.cargarConteo(), 30000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  private async cargarConteo(): Promise<void> {
    try {
      this.conteo.set(await notificacionesApi.obtenerConteo(this.auth.token()));
    } catch {
      // silencioso — la campanita no debe romper el resto del sitio si falla
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.abierto()) this.abierto.set(false);
  }

  @HostListener('document:mousedown', ['$event'])
  onClickAfuera(e: MouseEvent): void {
    if (!this.abierto()) return;
    const el = this.contenedor()?.nativeElement;
    if (el && !el.contains(e.target as Node)) this.abierto.set(false);
  }

  protected async abrirPanel(): Promise<void> {
    const yaAbierto = this.abierto();
    this.abierto.set(!yaAbierto);
    if (!yaAbierto) {
      try {
        this.notificaciones.set(await notificacionesApi.listarTodas(this.auth.token()));
      } catch {
        this.notificaciones.set([]);
      }
    }
  }

  private async marcarLeida(n: any): Promise<void> {
    if (n.leida) return;
    try {
      await notificacionesApi.marcarLeida(n, this.auth.token());
      this.notificaciones.update((prev) =>
        (prev || []).map((x) => (x.id === n.id && x.servicio === n.servicio ? { ...x, leida: true } : x)),
      );
      this.conteo.update((c) => Math.max(0, c - 1));
    } catch {
      // sin bloquear la UI si falla
    }
  }

  /**
   * Un clic hace las dos cosas: marca la notificación como leída (igual que
   * antes) y, si el evento apunta a algo concreto, lleva hasta ese recurso.
   * Si no hay destino, el panel se queda abierto como hasta ahora.
   */
  protected async abrirNotificacion(n: any): Promise<void> {
    await this.marcarLeida(n);
    const destino = await notificacionesApi.resolverDestino(n, this.auth.token()).catch(() => null);
    if (!destino) return;
    this.abierto.set(false);
    this.router.navigateByUrl(destino);
  }


  protected async marcarTodas(): Promise<void> {
    try {
      await notificacionesApi.marcarTodasLeidas(this.auth.token());
      this.notificaciones.update((prev) => (prev || []).map((x) => ({ ...x, leida: true })));
      this.conteo.set(0);
    } catch {
      // sin bloquear la UI si falla
    }
  }

  protected verTodas(): void {
    this.abierto.set(false);
    this.router.navigate(['/notificaciones']);
  }
}
