import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocHeader } from '../../components/doc-header';
import { tiempoRelativo } from '../../components/notification-bell';
import { GraficoBarras } from '../../components/charts/grafico-barras';
import { Icon } from '../../shared/icon';
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

/** Estados de la vacante (las llaves llegan en camelCase desde la API). */
const ESTADOS_VACANTE = [
  { llave: 'publicada', etiqueta: 'Publicada', punto: 'publicada' },
  { llave: 'enProceso', etiqueta: 'En proceso', punto: 'en_proceso' },
  { llave: 'cerrada', etiqueta: 'Cerrada', punto: 'cerrada' },
  { llave: 'borrador', etiqueta: 'Borrador', punto: 'borrador' },
  { llave: 'canceladaDesierta', etiqueta: 'Cancelada/Desierta', punto: 'cancelada_desierta' },
];

/** Estados de la postulación, en el orden del proceso. */
const ESTADOS_POSTULACION = [
  { estado: 'Recibida', clase: 'recibida' },
  { estado: 'En revisión', clase: 'en-revision' },
  { estado: 'Preseleccionado', clase: 'preseleccionado' },
  { estado: 'Entrevista programada', clase: 'entrevista' },
  { estado: 'Aceptada', clase: 'aceptada' },
  { estado: 'Rechazada', clase: 'rechazada' },
  { estado: 'Retirada', clase: 'retirada' },
];

type TipoActividad = 'vacante' | 'postulacion' | 'usuario';
interface Actividad {
  fecha: string;
  tipo: TipoActividad;
  titulo: string;
  detalle: string;
}
const ICONO_ACTIVIDAD: Record<TipoActividad, string> = { vacante: 'briefcase', postulacion: 'documento', usuario: 'persona' };

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, DocHeader, GraficoBarras, Icon],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Dashboard" />
    <main class="page db-pagina">
      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      } @else if (!cargado()) {
        <div class="ps-tarjeta cand-vacio"><p class="text-muted" style="margin: 0">Cargando estadísticas…</p></div>
      } @else {
        <div class="ps-encabezado">
          <div>
            <h2 class="ps-encabezado__titulo">{{ saludo() }}</h2>
            <p class="ps-encabezado__resumen">Así va el sistema de selección de talento hoy.</p>
          </div>
          <div class="db-atajos">
            <a routerLink="/usuarios" class="btn btn-secondary btn-sm"><app-icon name="users" [size]="15" [strokeWidth]="2" />Usuarios</a>
            <a routerLink="/auditoria" class="btn btn-secondary btn-sm"><app-icon name="shield" [size]="15" [strokeWidth]="2" />Auditoría</a>
            <a routerLink="/gestion-humana" class="btn btn-primary btn-sm"><app-icon name="mas" [size]="15" [strokeWidth]="2.2" />Crear proceso</a>
          </div>
        </div>

        <!-- Indicadores principales: cada uno lleva a la sección donde se gestiona. -->
        <div class="db-kpis">
          <a routerLink="/candidatos" class="db-kpi">
            <span class="db-kpi__icono"><app-icon name="documento" [size]="18" [strokeWidth]="2" /></span>
            <span class="db-kpi__etiqueta">Postulaciones</span>
            <span class="db-kpi__valor">{{ postulaciones().total }}</span>
            <span class="db-kpi__sub">{{ postulacionesEsteMes() }} este mes</span>
          </a>
          <a routerLink="/candidatos" class="db-kpi" [class.db-kpi--alerta]="sinRevisar() > 0">
            <span class="db-kpi__icono"><app-icon name="bell" [size]="18" [strokeWidth]="2" /></span>
            <span class="db-kpi__etiqueta">Sin revisar</span>
            <span class="db-kpi__valor">{{ sinRevisar() }}</span>
            <span class="db-kpi__sub">{{ sinRevisar() > 0 ? 'Postulaciones en "Recibida"' : 'Todo al día' }}</span>
          </a>
          <a routerLink="/gestion-humana" class="db-kpi">
            <span class="db-kpi__icono"><app-icon name="briefcase" [size]="18" [strokeWidth]="2" /></span>
            <span class="db-kpi__etiqueta">Procesos publicados</span>
            <span class="db-kpi__valor">{{ vacantes().activas }}<span class="db-kpi__de"> de {{ vacantes().total }}</span></span>
            <span class="db-kpi__sub">{{ vacantes().abiertas }} con convocatoria abierta</span>
          </a>
          <a routerLink="/usuarios" class="db-kpi">
            <span class="db-kpi__icono"><app-icon name="users" [size]="18" [strokeWidth]="2" /></span>
            <span class="db-kpi__etiqueta">Usuarios</span>
            <span class="db-kpi__valor">{{ usuarios().total }}</span>
            <span class="db-kpi__sub">{{ porRol()['candidato'] || 0 }} candidatos · {{ internos() }} internos</span>
          </a>
        </div>

        <div class="db-grid">
          <section class="ps-tarjeta db-panel db-panel--ancho" aria-labelledby="db-mes">
            <div class="db-panel__cabecera">
              <h3 class="db-panel__titulo" id="db-mes">Postulaciones por mes</h3>
              <span class="db-panel__sub">Últimos 6 meses</span>
            </div>
            @if (postulaciones().total === 0) {
              <p class="db-vacio">Todavía no hay postulaciones.</p>
            } @else {
              <app-grafico-barras [datos]="datosBarras()" etiqueta="mes" valor="total" relleno="#2EA04A" unidad="postulaciones" />
            }
          </section>

          <section class="ps-tarjeta db-panel" aria-labelledby="db-procesos">
            <div class="db-panel__cabecera">
              <h3 class="db-panel__titulo" id="db-procesos">Procesos por estado</h3>
              <a routerLink="/gestion-humana" class="db-panel__enlace">Ver todos</a>
            </div>
            @if (vacantes().total === 0) {
              <p class="db-vacio">Todavía no hay procesos creados.</p>
            } @else {
              <ul class="db-barras">
                @for (e of procesosPorEstado(); track e.llave) {
                  <li class="db-barra">
                    <span class="db-barra__etiqueta"><span class="ps-punto ps-punto--{{ e.punto }}"></span>{{ e.etiqueta }}</span>
                    <span class="db-barra__valor">{{ e.valor }}</span>
                    <span class="db-barra__pista"><span class="db-barra__relleno db-barra__relleno--{{ e.punto }}" [style.width.%]="e.porcentaje"></span></span>
                  </li>
                }
              </ul>
            }
          </section>

          <section class="ps-tarjeta db-panel db-panel--ancho" aria-labelledby="db-actividad">
            <div class="db-panel__cabecera">
              <h3 class="db-panel__titulo" id="db-actividad">Actividad reciente</h3>
              <a routerLink="/auditoria" class="db-panel__enlace">Ver auditoría</a>
            </div>
            @if (actividad().length === 0) {
              <p class="db-vacio">Todavía no hay actividad registrada.</p>
            } @else {
              <ul class="db-actividad">
                @for (a of actividad(); track $index) {
                  <li class="db-actividad__item">
                    <span class="db-actividad__icono db-actividad__icono--{{ a.tipo }}"><app-icon [name]="iconoActividad[a.tipo]" [size]="15" [strokeWidth]="2" /></span>
                    <div class="db-actividad__texto">
                      <span class="db-actividad__titulo">{{ a.titulo }}</span>
                      <span class="db-actividad__detalle">{{ a.detalle }}</span>
                    </div>
                    <time class="db-actividad__fecha" [attr.datetime]="a.fecha">{{ tiempoRelativo(a.fecha) }}</time>
                  </li>
                }
              </ul>
            }
          </section>

          <section class="ps-tarjeta db-panel" aria-labelledby="db-embudo">
            <div class="db-panel__cabecera">
              <h3 class="db-panel__titulo" id="db-embudo">Estado de las postulaciones</h3>
              <a routerLink="/candidatos" class="db-panel__enlace">Ver todas</a>
            </div>
            @if (postulaciones().total === 0) {
              <p class="db-vacio">Todavía no hay postulaciones.</p>
            } @else {
              <ul class="db-estados">
                @for (e of postulacionesPorEstado(); track e.estado) {
                  <li class="db-estado" [class.is-cero]="e.valor === 0">
                    <span class="estado-badge estado-badge--{{ e.clase }}">{{ e.estado }}</span>
                    <span class="db-estado__valor">{{ e.valor }}</span>
                  </li>
                }
              </ul>
            }
          </section>
        </div>
      }
    </main>
  `,
})
export class DashboardPage {
  private readonly auth = inject(AuthService);
  protected readonly tiempoRelativo = tiempoRelativo;
  protected readonly iconoActividad = ICONO_ACTIVIDAD;

  protected readonly usuarios = signal<any>(null);
  protected readonly vacantes = signal<any>(null);
  protected readonly postulaciones = signal<any>(null);
  protected readonly error = signal('');
  protected readonly datosBarras = signal<any[]>([]);
  protected readonly actividad = signal<Actividad[]>([]);

  protected readonly cargado = computed(() => !!(this.usuarios() && this.vacantes() && this.postulaciones()));

  protected readonly saludo = computed(() => {
    const nombre = (this.auth.usuario()?.nombreCompleto || '').trim().split(/\s+/)[0];
    const hora = new Date().getHours();
    const base = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
    return nombre ? `${base}, ${nombre}` : base;
  });

  protected readonly porRol = computed<Record<string, number>>(() => this.usuarios()?.porRol || {});
  protected readonly internos = computed(() => (this.porRol()['gestorHumano'] || this.porRol()['gestor_humano'] || 0) + (this.porRol()['admin'] || 0));
  protected readonly sinRevisar = computed(() => this.postulaciones()?.porEstado?.['Recibida'] || 0);
  protected readonly postulacionesEsteMes = computed(() => {
    const meses = this.postulaciones()?.porMes || [];
    return meses.length ? meses[meses.length - 1].total : 0;
  });

  protected readonly procesosPorEstado = computed(() => {
    const porEstado = this.vacantes()?.porEstado || {};
    const total = Math.max(1, this.vacantes()?.total || 0);
    return ESTADOS_VACANTE.map((e) => ({ ...e, valor: porEstado[e.llave] || 0, porcentaje: ((porEstado[e.llave] || 0) / total) * 100 }));
  });

  protected readonly postulacionesPorEstado = computed(() => {
    const porEstado = this.postulaciones()?.porEstado || {};
    return ESTADOS_POSTULACION.map((e) => ({ ...e, valor: porEstado[e.estado] || 0 }));
  });

  constructor() {
    const token = this.auth.token();
    Promise.all([authApi.obtenerEstadisticas(token), vacantesApi.obtenerEstadisticas(token), solicitudesApi.obtenerEstadisticas(token)])
      .then(([u, v, c]) => {
        this.datosBarras.set(c.porMes.map((p: any) => ({ mes: formatearMes(p.mes), total: p.total })));
        this.actividad.set(
          [
            ...v.recientes.map((x: any): Actividad => ({ fecha: x.fechaCreacion, tipo: 'vacante', titulo: x.cargo, detalle: 'Nuevo proceso de selección' })),
            ...c.recientes.map((s: any): Actividad => ({ fecha: s.fechaSolicitud, tipo: 'postulacion', titulo: s.nombreCompleto || 'Un candidato', detalle: 'Se postuló a un proceso' })),
            ...u.recientes.map((x: any): Actividad => ({ fecha: x.fechaCreacion, tipo: 'usuario', titulo: x.nombreCompleto, detalle: `Nueva cuenta · ${ETIQUETA_ROL[x.rol] || x.rol}` })),
          ]
            .filter((a) => a.fecha)
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
            .slice(0, 7),
        );
        this.usuarios.set(u);
        this.vacantes.set(v);
        this.postulaciones.set(c);
      })
      .catch(() => this.error.set('No se pudieron cargar las estadísticas. Verifica que los 3 backends estén corriendo.'));
  }
}
