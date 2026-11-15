import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocHeader } from '../../components/doc-header';
import { tiempoRelativo } from '../../components/notification-bell';
import { GraficoBarras } from '../../components/charts/grafico-barras';
import { GraficoDona, SegmentoDona } from '../../components/charts/grafico-dona';
import { AuthService } from '../../core/auth.service';
import * as authApi from '../../lib/api/authApi';
import * as vacantesApi from '../../lib/api/vacantesApi';
import * as solicitudesApi from '../../lib/api/solicitudesApi';

const ETIQUETA_ROL: Record<string, string> = { candidato: 'Candidato', gestor_humano: 'Gestión Humana', admin: 'Administrador' };

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function formatearMes(mesISO: string): string {
  const [, mes] = mesISO.split('-');
  return NOMBRES_MES[parseInt(mes, 10) - 1] || mesISO;
}

const ETIQUETA_ESTADO_VACANTE: Record<string, string> = {
  publicada: 'Publicada',
  enProceso: 'En proceso',
  cerrada: 'Cerrada',
  borrador: 'Borrador',
  canceladaDesierta: 'Cancelada/Desierta',
};
const COLOR_ESTADO_VACANTE: Record<string, string> = {
  publicada: '#2EA04A',
  enProceso: '#E8B93A',
  cerrada: '#C0574F',
  borrador: '#B7C4C2',
  canceladaDesierta: '#4E8FD1',
};

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, DocHeader, GraficoBarras, GraficoDona],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Dashboard" [showCode]="false" />
    @if (error()) {
      <main class="page"><div class="card"><div class="notice notice--danger">{{ error() }}</div></div></main>
    } @else if (!loginStats() || !vacantesStats() || !candidatosStats()) {
      <main class="page"><div class="card"><p class="text-muted">Cargando estadísticas…</p></div></main>
    } @else {
      <main class="page" style="max-width: 1100px">
        <p class="section-intro" style="margin-top: -8px">Resumen general del sistema de selección de talento.</p>

        <div class="stat-cards-grid">
          <div class="stat-card">
            <div class="stat-card__value">{{ loginStats().total }}</div>
            <div class="stat-card__label">Usuarios registrados</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__value">{{ vacantesStats().activas }}</div>
            <div class="stat-card__label">Vacantes activas</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__value">{{ candidatosStats().total }}</div>
            <div class="stat-card__label">Postulaciones</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__value">{{ vacantesStats().abiertas }}</div>
            <div class="stat-card__label">Vacantes abiertas</div>
          </div>
        </div>

        <div class="dashboard-charts-grid">
          <div class="card">
            <h2 class="section-title" style="font-size: 15px">Postulaciones por mes</h2>
            <app-grafico-barras [datos]="datosBarras()" etiqueta="mes" valor="total" />
          </div>

          <div class="card">
            <h2 class="section-title" style="font-size: 15px">Vacantes por estado</h2>
            @if (datosDonut().length === 0) {
              <p class="text-muted" style="font-size: 13px; text-align: center; padding: 80px 0">Todavía no hay vacantes creadas.</p>
            } @else {
              <app-grafico-dona [segmentos]="datosDonut()" />
            }
          </div>

          <div class="card">
            <h2 class="section-title" style="font-size: 15px">Actividad reciente</h2>
            @if (actividad().length === 0) {
              <p class="text-muted" style="font-size: 13px">Todavía no hay actividad registrada.</p>
            } @else {
              <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px">
                @for (a of actividad(); track $index) {
                  <li style="font-size: 13px">
                    <div style="color: var(--color-text)">{{ a.texto }}</div>
                    <div class="text-muted" style="font-size: 11.5px">{{ tiempoRelativo(a.fecha) }}</div>
                  </li>
                }
              </ul>
            }
          </div>
        </div>

        <div class="dashboard-actions-grid">
          <a routerLink="/gestion-humana" class="card dashboard-action">+ Crear vacante</a>
          <a routerLink="/gestion-humana" class="card dashboard-action">Ver postulaciones</a>
          <a routerLink="/usuarios" class="card dashboard-action">Gestionar usuarios</a>
        </div>
      </main>
    }
  `,
})
export class DashboardPage {
  private readonly auth = inject(AuthService);
  protected readonly tiempoRelativo = tiempoRelativo;
  protected readonly loginStats = signal<any>(null);
  protected readonly vacantesStats = signal<any>(null);
  protected readonly candidatosStats = signal<any>(null);
  protected readonly error = signal('');

  // Se calculan una vez al llegar los datos (los gráficos reciben siempre el mismo arreglo).
  protected readonly datosDonut = signal<SegmentoDona[]>([]);
  protected readonly datosBarras = signal<any[]>([]);
  protected readonly actividad = signal<{ fecha: string; texto: string }[]>([]);

  constructor() {
    const token = this.auth.token();
    Promise.all([authApi.obtenerEstadisticas(token), vacantesApi.obtenerEstadisticas(token), solicitudesApi.obtenerEstadisticas(token)])
      .then(([l, v, c]) => {
        this.datosDonut.set(
          Object.entries(v.porEstado || {})
            .map(([estado, valor]: [string, any]) => ({
              name: ETIQUETA_ESTADO_VACANTE[estado] || estado,
              value: valor,
              color: COLOR_ESTADO_VACANTE[estado] || '#B7C4C2',
            }))
            .filter((d) => d.value > 0),
        );
        this.datosBarras.set(c.porMes.map((p: any) => ({ mes: formatearMes(p.mes), total: p.total })));
        this.actividad.set(
          [
            ...v.recientes.map((x: any) => ({ fecha: x.fechaCreacion, texto: `Nueva vacante publicada: ${x.cargo}` })),
            ...c.recientes.map((s: any) => ({ fecha: s.fechaSolicitud, texto: `Nueva postulación de ${s.nombreCompleto || 'un candidato'}` })),
            ...l.recientes.map((u: any) => ({
              fecha: u.fechaCreacion,
              texto: `Nuevo usuario registrado: ${u.nombreCompleto} (${ETIQUETA_ROL[u.rol] || u.rol})`,
            })),
          ]
            .filter((a) => a.fecha)
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
            .slice(0, 8),
        );
        this.loginStats.set(l);
        this.vacantesStats.set(v);
        this.candidatosStats.set(c);
      })
      .catch(() => this.error.set('No se pudieron cargar las estadísticas. Verifica que los 3 backends estén corriendo.'));
  }
}
