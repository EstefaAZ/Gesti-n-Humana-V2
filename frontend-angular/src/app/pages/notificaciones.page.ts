import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DocHeader } from '../components/doc-header';
import { tiempoRelativo } from '../components/notification-bell';
import { Icon } from '../shared/icon';
import { AuthService } from '../core/auth.service';
import * as notificacionesApi from '../lib/api/notificacionesApi';

/** Ícono (del set de la app) por tipo de notificación; antes eran emojis. */
const ICONO_NOTIFICACION: Record<string, string> = {
  solicitud_creada: 'documento',
  estado_cambiado: 'bell',
  cuenta_desactivada: 'lock',
  cuenta_reactivada: 'check',
  nueva_postulacion: 'users',
};

function fechaCompleta(fechaISO: string | null | undefined): string {
  if (!fechaISO) return '';
  return new Date(fechaISO).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Hoy / Ayer / Esta semana / Anteriores, según la fecha local. */
function grupoDe(fechaISO: string | null | undefined): string {
  if (!fechaISO) return 'Anteriores';
  const f = new Date(fechaISO);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  const dias = Math.round((hoy.getTime() - dia.getTime()) / 86400000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return 'Esta semana';
  return 'Anteriores';
}

const ORDEN_GRUPOS = ['Hoy', 'Ayer', 'Esta semana', 'Anteriores'];

@Component({
  selector: 'app-notificaciones-page',
  imports: [DocHeader, Icon],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Notificaciones" />
    <main class="page">
      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      }

      <div class="cand-encabezado">
        <div>
          <h2 class="cand-encabezado__titulo">Tus notificaciones</h2>
          <p class="cand-encabezado__sub">
            @if (noLeidas() > 0) {
              Tienes <strong>{{ noLeidas() }}</strong> {{ noLeidas() === 1 ? 'notificación sin leer' : 'notificaciones sin leer' }}
            } @else {
              Estás al día
            }
          </p>
        </div>
        @if (noLeidas() > 0) {
          <button type="button" class="btn btn-secondary btn-sm" (click)="marcarTodas()">
            <app-icon name="check" [size]="14" [strokeWidth]="2.4" /> Marcar todas como leídas
          </button>
        }
      </div>

      <div class="ps-tarjeta">
        <div class="cand-notif__barra">
          <div class="ps-filtros" role="group" aria-label="Filtrar notificaciones">
            <button type="button" class="ps-chip" [class.is-activo]="filtro() === 'todas'" [attr.aria-pressed]="filtro() === 'todas'" (click)="filtro.set('todas')">
              Todas <span class="ps-chip__conteo">{{ (notificaciones() || []).length }}</span>
            </button>
            <button type="button" class="ps-chip" [class.is-activo]="filtro() === 'nuevas'" [attr.aria-pressed]="filtro() === 'nuevas'" (click)="filtro.set('nuevas')">
              Sin leer <span class="ps-chip__conteo">{{ noLeidas() }}</span>
            </button>
          </div>
        </div>

        @if (notificaciones() === null && !error()) {
          <p class="ps-vacio" style="margin: 0">Cargando…</p>
        } @else if (grupos().length === 0) {
          <div class="cand-vacio">
            <span class="cand-vacio__icono" aria-hidden="true"><app-icon name="bell" [size]="22" [strokeWidth]="1.8" /></span>
            <p class="cand-vacio__titulo">{{ filtro() === 'nuevas' ? 'No tienes notificaciones sin leer' : 'Todavía no tienes notificaciones' }}</p>
            <p class="cand-vacio__texto">Te avisaremos aquí cuando recibamos tu postulación o cambie su estado.</p>
          </div>
        } @else {
          @for (g of grupos(); track g.nombre) {
            <h3 class="cand-notif__grupo">{{ g.nombre }}</h3>
            <ul class="cand-notif__lista">
              @for (n of g.items; track n.servicio + '-' + n.id) {
                <li>
                  <button type="button" class="cand-notif" [class.is-nueva]="!n.leida" (click)="abrirNotificacion(n)">
                    <span class="cand-notif__icono" aria-hidden="true"><app-icon [name]="icono(n.tipo)" [size]="18" [strokeWidth]="1.9" /></span>
                    <span class="cand-notif__texto">
                      <span class="cand-notif__titulo">
                        {{ n.titulo }}
                        @if (!n.leida) {
                          <span class="sr-only">(sin leer)</span>
                        }
                      </span>
                      <span class="cand-notif__mensaje">{{ n.mensaje }}</span>
                      <span class="cand-notif__fecha" [title]="fechaCompleta(n.fechaCreacion)">{{ tiempoRelativo(n.fechaCreacion) }} · {{ fechaCompleta(n.fechaCreacion) }}</span>
                    </span>
                    <span class="cand-notif__punto" [class.cand-notif__punto--leida]="n.leida" aria-hidden="true"></span>
                  </button>
                </li>
              }
            </ul>
          }
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
  protected readonly filtro = signal<'todas' | 'nuevas'>('todas');
  protected readonly fechaCompleta = fechaCompleta;
  protected readonly tiempoRelativo = tiempoRelativo;

  protected readonly noLeidas = computed(() => (this.notificaciones() || []).filter((n) => !n.leida).length);

  protected readonly grupos = computed(() => {
    const lista = (this.notificaciones() || []).filter((n) => this.filtro() === 'todas' || !n.leida);
    const porGrupo = new Map<string, any[]>();
    for (const n of lista) {
      const g = grupoDe(n.fechaCreacion);
      if (!porGrupo.has(g)) porGrupo.set(g, []);
      porGrupo.get(g)!.push(n);
    }
    return ORDEN_GRUPOS.filter((g) => porGrupo.has(g)).map((nombre) => ({ nombre, items: porGrupo.get(nombre)! }));
  });

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

  protected icono(tipo: string): string {
    return ICONO_NOTIFICACION[tipo] || 'bell';
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
    const destino = await notificacionesApi.resolverDestino(n, this.auth.token(), this.auth.esGestion()).catch(() => null);
    if (destino) this.router.navigateByUrl(destino);
  }
}
