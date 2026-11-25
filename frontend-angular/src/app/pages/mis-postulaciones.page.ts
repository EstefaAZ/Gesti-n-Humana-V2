import { AfterViewChecked, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DocHeader } from '../components/doc-header';
import { EstadoPostulacionBadge } from '../components/estado-postulacion-badge';
import { Icon } from '../shared/icon';
import { AuthService } from '../core/auth.service';
import * as solicitudesApi from '../lib/api/solicitudesApi';
import { formatearFecha } from '../lib/formato';
import { CertificadosPostulacion } from '../components/certificados-postulacion';

/** Etapas del proceso, en orden. La última se reemplaza por el resultado. */
const ETAPAS = ['Recibida', 'En revisión', 'Preseleccionado', 'Entrevista programada', 'Decisión'];
const ESTADOS_FINALES = ['Aceptada', 'Rechazada', 'Retirada'];

type Convocatoria = { clase: string; icono: string; titulo: string; detalle: string };

@Component({
  selector: 'app-mis-postulaciones-page',
  imports: [RouterLink, DocHeader, EstadoPostulacionBadge, Icon, CertificadosPostulacion],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Mis postulaciones" />
    <main class="page">
      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      }

      @if (postulaciones() === null && !error()) {
        <div class="ps-tarjeta cand-vacio"><p class="text-muted" style="margin: 0">Cargando tus postulaciones…</p></div>
      }

      @if (postulaciones(); as lista) {
        @if (lista.length === 0) {
          <div class="ps-tarjeta cand-vacio">
            <span class="cand-vacio__icono" aria-hidden="true"><app-icon name="folder" [size]="22" [strokeWidth]="1.8" /></span>
            <p class="cand-vacio__titulo">Aún no tienes postulaciones</p>
            <p class="cand-vacio__texto">Cuando te inscribas a una convocatoria, aquí podrás seguir su estado y descargar tu solicitud.</p>
            <a routerLink="/" class="btn btn-primary btn-sm">Ver vacantes abiertas</a>
          </div>
        } @else {
          <div class="cand-encabezado">
            <div>
              <h2 class="cand-encabezado__titulo">Tus procesos de selección</h2>
              <p class="cand-encabezado__sub">
                <strong>{{ enCurso() }}</strong> en curso · <strong>{{ lista.length - enCurso() }}</strong> {{ lista.length - enCurso() === 1 ? 'finalizada' : 'finalizadas' }}
              </p>
            </div>
            <div class="ps-filtros" role="group" aria-label="Filtrar postulaciones">
              @for (f of filtros; track f.valor) {
                <button type="button" class="ps-chip" [class.is-activo]="filtro() === f.valor" [attr.aria-pressed]="filtro() === f.valor" (click)="filtro.set(f.valor)">
                  {{ f.etiqueta }}
                </button>
              }
            </div>
          </div>

          @if (filtradas().length === 0) {
            <div class="ps-tarjeta cand-vacio">
              <p class="cand-vacio__titulo">{{ filtro() === 'curso' ? 'No tienes postulaciones en curso' : 'No tienes postulaciones finalizadas' }}</p>
            </div>
          }

          <div class="cand-postulaciones">
            @for (p of filtradas(); track p.radicado) {
              <article class="ps-tarjeta cand-postulacion" [class.is-destacada]="p.radicado === radicadoDestacado()" [attr.id]="'postulacion-' + p.radicado">
                <div class="cand-postulacion__top">
                  <div style="min-width: 0">
                    <h3 class="cand-postulacion__cargo">{{ p.vacanteCargo || 'Vacante' }}</h3>
                    <div class="cand-postulacion__meta">
                      @if (p.vacanteProcesoNo) {
                        <span>Proceso {{ p.vacanteProcesoNo }}</span>
                      }
                      <span>Radicado <span class="mono">{{ p.radicado }}</span></span>
                      @if (p.fechaSolicitud) {
                        <span>Enviada el {{ fechaCorta(p.fechaSolicitud) }}</span>
                      }
                    </div>
                  </div>
                  <app-estado-postulacion-badge [estado]="p.estado" />
                </div>

                @if (convocatoria(p); as c) {
                  <div class="cand-convocatoria {{ c.clase }}" role="status">
                    <app-icon [name]="c.icono" [size]="16" [strokeWidth]="2" />
                    <div><strong>{{ c.titulo }}</strong><span>{{ c.detalle }}</span></div>
                  </div>
                }

                @if (p.estado === 'Retirada') {
                  <p class="text-muted" style="font-size: 13px; margin: 14px 0 0">Te retiraste de este proceso. Tus datos se conservan, pero ya no participas en la selección.</p>
                } @else {
                  <ol class="cand-etapas" aria-label="Avance de tu postulación">
                    @for (etapa of etapas; track etapa; let i = $index) {
                      <li
                        class="cand-etapa"
                        [class.is-hecha]="i < indiceEtapa(p)"
                        [class.is-actual]="i === indiceEtapa(p)"
                        [class.is-negativa]="i === indiceEtapa(p) && p.estado === 'Rechazada'"
                        [attr.aria-current]="i === indiceEtapa(p) ? 'step' : null"
                      >
                        {{ i === etapas.length - 1 && esFinal(p) ? p.estado : etapa }}
                      </li>
                    }
                  </ol>
                }

                <app-certificados-postulacion [postulacion]="p" (actualizada)="reemplazar($event)" />

                <div class="cand-postulacion__acciones">
                  <button type="button" class="btn btn-secondary btn-sm" (click)="descargarPdf(p.radicado)">
                    <app-icon name="descargar" [size]="14" [strokeWidth]="2" /> Descargar solicitud (PDF)
                  </button>
                  @if (puedeRetirarse(p)) {
                    <button type="button" class="btn btn-danger-outline btn-sm" (click)="retirarPostulacion(p.radicado)">Retirarme del proceso</button>
                  }
                </div>
              </article>
            }
          </div>
        }
      }
    </main>
  `,
})
export class MisPostulacionesPage implements AfterViewChecked {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  protected readonly postulaciones = signal<any[] | null>(null);
  protected readonly error = signal('');
  protected readonly etapas = ETAPAS;
  protected readonly filtros = [
    { valor: 'todas', etiqueta: 'Todas' },
    { valor: 'curso', etiqueta: 'En curso' },
    { valor: 'finalizadas', etiqueta: 'Finalizadas' },
  ];
  protected readonly filtro = signal('todas');

  /** Reemplaza una postulación por su versión actualizada (p. ej. tras enviar certificados). */
  protected reemplazar(actualizada: any): void {
    this.postulaciones.update((lista) =>
      (lista || []).map((p) => (p.radicado === actualizada.radicado ? { ...p, ...actualizada, convocatoria: p.convocatoria } : p)),
    );
  }

  // Las notificaciones y la lista de vacantes enlazan aquí con ?radicado=…: se resalta esa postulación.
  private readonly queryParams = toSignal(this.route.queryParamMap);
  protected readonly radicadoDestacado = computed(() => this.queryParams()?.get('radicado') ?? null);
  private yaDesplace = false;

  constructor() {
    solicitudesApi
      .misSolicitudes(this.auth.token())
      .then((p) => this.postulaciones.set(p))
      .catch(() => this.error.set('No se pudieron cargar tus postulaciones.'));
  }

  ngAfterViewChecked(): void {
    const radicado = this.radicadoDestacado();
    if (this.yaDesplace || !radicado || !this.postulaciones()) return;
    const el = document.getElementById('postulacion-' + radicado);
    if (el) {
      this.yaDesplace = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  protected esFinal(p: any): boolean {
    return ESTADOS_FINALES.includes(p.estado);
  }

  /** En curso: la postulación no tiene resultado y la convocatoria no se canceló. */
  private estaEnCurso(p: any): boolean {
    if (this.esFinal(p)) return false;
    return !(p.convocatoria?.estado === 'cancelada_desierta' || p.convocatoria?.eliminada);
  }

  protected enCurso(): number {
    return (this.postulaciones() || []).filter((p) => this.estaEnCurso(p)).length;
  }

  protected filtradas(): any[] {
    const lista = this.postulaciones() || [];
    if (this.filtro() === 'curso') return lista.filter((p) => this.estaEnCurso(p));
    if (this.filtro() === 'finalizadas') return lista.filter((p) => !this.estaEnCurso(p));
    return lista;
  }

  protected indiceEtapa(p: any): number {
    if (this.esFinal(p)) return ETAPAS.length - 1;
    const i = ETAPAS.indexOf(p.estado);
    return i === -1 ? 0 : i;
  }

  protected puedeRetirarse(p: any): boolean {
    return this.estaEnCurso(p);
  }

  /** Estado actual de la convocatoria, explicado al candidato. */
  protected convocatoria(p: any): Convocatoria | null {
    const c = p.convocatoria;
    if (!c) return null;
    const final = this.esFinal(p);
    if (c.eliminada) {
      return { clase: 'cand-convocatoria--cerrada', icono: 'circle', titulo: 'Convocatoria no disponible', detalle: 'Esta convocatoria ya no está publicada.' };
    }
    if (c.estado === 'cancelada_desierta') {
      return {
        clase: 'cand-convocatoria--cancelada',
        icono: 'cuentaX',
        titulo: 'Convocatoria cancelada',
        detalle: 'Gestión Humana canceló o declaró desierto este proceso de selección.',
      };
    }
    if (c.estado === 'en_proceso') {
      return {
        clase: 'cand-convocatoria--proceso',
        icono: 'users',
        titulo: 'Convocatoria cerrada · en proceso de selección',
        detalle: final ? 'Ya no se reciben inscripciones.' : 'Ya no se reciben inscripciones; Gestión Humana está evaluando a los aspirantes.',
      };
    }
    if (c.estaCerrada || c.estado === 'cerrada') {
      return {
        clase: 'cand-convocatoria--cerrada',
        icono: 'lock',
        titulo: 'Convocatoria cerrada',
        detalle: final ? 'Ya no se reciben inscripciones.' : 'Ya no se reciben inscripciones; tu postulación sigue en revisión.',
      };
    }
    const cierre = c.fechaCierre ? `Cierra el ${formatearFecha(c.fechaCierre)}${c.horaCierre ? ' a las ' + c.horaCierre : ''}.` : 'Sin fecha de cierre definida.';
    return { clase: '', icono: 'calendario', titulo: 'Convocatoria abierta', detalle: cierre };
  }

  protected fechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  protected descargarPdf(radicado: string): void {
    solicitudesApi.descargarPdf(radicado, this.auth.token());
  }

  protected async retirarPostulacion(radicado: string): Promise<void> {
    if (!window.confirm('¿Retirarte de este proceso de selección? Tus datos se conservan, solo queda marcado que ya no sigues en el proceso.')) return;
    try {
      const actualizada = await solicitudesApi.retirar(radicado, this.auth.token());
      // La respuesta de "retirar" no trae el estado de la convocatoria: se conserva el que ya teníamos.
      this.postulaciones.update((prev) =>
        (prev || []).map((p) => (p.radicado === radicado ? { ...actualizada, convocatoria: p.convocatoria } : p)),
      );
    } catch (e: any) {
      alert(e.detail || 'No se pudo retirar la postulación.');
    }
  }
}
