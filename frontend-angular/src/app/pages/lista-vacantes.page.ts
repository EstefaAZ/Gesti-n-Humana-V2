import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocHeader } from '../components/doc-header';
import { Icon } from '../shared/icon';
import { AuthService } from '../core/auth.service';
import * as vacantesApi from '../lib/api/vacantesApi';
import * as solicitudesApi from '../lib/api/solicitudesApi';
import { formatearFecha } from '../lib/formato';

/** Días desde la publicación (0 = hoy), o null si no hay fecha válida. */
function diasDesdePublicacion(fechaCreacion: string | null | undefined): number | null {
  if (!fechaCreacion) return null;
  const publicada = new Date(fechaCreacion);
  if (Number.isNaN(publicada.getTime())) return null;
  const inicioPublicada = new Date(publicada.getFullYear(), publicada.getMonth(), publicada.getDate());
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  return Math.round((inicioHoy.getTime() - inicioPublicada.getTime()) / 86400000);
}

/** "Cierra hoy" / "Cierra mañana" / "Cierra en N días" si falta una semana o menos. */
function avisoCierre(v: any): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.fechaCierre || '');
  if (!m) return null;
  const [h, min] = String(v.horaCierre || '23:59').split(':').map(Number);
  const cierre = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h || 0, min || 0);
  const ahora = new Date();
  if (cierre <= ahora) return null;
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dias = Math.round((new Date(cierre.getFullYear(), cierre.getMonth(), cierre.getDate()).getTime() - hoy.getTime()) / 86400000);
  if (dias > 7) return null;
  if (dias === 0) return 'Cierra hoy';
  return dias === 1 ? 'Cierra mañana' : `Cierra en ${dias} días`;
}

/**
 * Convocatorias abiertas. El backend solo devuelve las publicadas y vigentes:
 * las cerradas o canceladas no aparecen aquí (si el candidato se postuló a una,
 * la ve en "Mis postulaciones" con el aviso de cierre).
 */
@Component({
  selector: 'app-lista-vacantes-page',
  imports: [RouterLink, DocHeader, Icon],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Convocatorias abiertas" />
    <main class="page">
      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      }

      @if (!error() && vacantes() === null) {
        <div class="ps-tarjeta cand-vacio"><p class="text-muted" style="margin: 0">Cargando convocatorias…</p></div>
      }

      @if (vacantes(); as lista) {
        @if (lista.length === 0) {
          <div class="ps-tarjeta cand-vacio">
            <span class="cand-vacio__icono" aria-hidden="true"><app-icon name="briefcase" [size]="22" [strokeWidth]="1.8" /></span>
            <p class="cand-vacio__titulo">No hay convocatorias abiertas en este momento</p>
            <p class="cand-vacio__texto">Cuando Gestión Humana publique una nueva vacante aparecerá aquí. Mientras tanto, mantén tu perfil al día para postularte con un solo clic.</p>
            @if (esCandidato()) {
              <a routerLink="/perfil" class="btn btn-secondary btn-sm">Revisar mi perfil</a>
            }
          </div>
        } @else {
          <div class="cand-encabezado">
            <div>
              <h2 class="cand-encabezado__titulo">Vacantes disponibles</h2>
              <p class="cand-encabezado__sub">
                <strong>{{ lista.length }}</strong> {{ lista.length === 1 ? 'convocatoria abierta' : 'convocatorias abiertas' }} en Aguas Nacionales EPM
              </p>
            </div>
            <div class="ps-buscador">
              <span class="ps-buscador__icono" aria-hidden="true"><app-icon name="buscar" [size]="16" [strokeWidth]="2" /></span>
              <input type="search" aria-label="Buscar vacantes" autocomplete="off" placeholder="Buscar por cargo, sede o palabra clave…" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
            </div>
          </div>

          @if (filtradas().length === 0) {
            <div class="ps-tarjeta cand-vacio">
              <p class="cand-vacio__titulo">Ninguna vacante coincide con "{{ busqueda() }}"</p>
              <button type="button" class="btn btn-secondary btn-sm" (click)="busqueda.set('')">Ver todas</button>
            </div>
          } @else {
            <div class="cand-vacantes">
              @for (v of filtradas(); track v.id) {
                <article class="ps-tarjeta cand-vacante">
                  <div class="cand-vacante__top">
                    <span class="ps-meta__codigo" style="color: var(--color-text-muted)">Proceso {{ v.procesoNo }}</span>
                    @if (postulacionDe(v.id)) {
                      <span class="cand-pildora cand-pildora--postulado"><app-icon name="check" [size]="12" [strokeWidth]="2.6" /> Ya te postulaste</span>
                    } @else if (v.aunNoAbre) {
                      <span class="cand-pildora cand-pildora--pronto">Abre el {{ fecha(v.fechaApertura) }}</span>
                    } @else if (esNueva(v)) {
                      <span class="cand-pildora cand-pildora--nueva">Nueva</span>
                    }
                  </div>
                  <h3 class="cand-vacante__cargo">{{ v.cargo }}</h3>
                  @if (v.descripcion) {
                    <p class="cand-vacante__descripcion">{{ v.descripcion }}</p>
                  }
                  <div class="cand-vacante__datos">
                    @if (v.sede) {
                      <span><app-icon name="ubicacion" [size]="14" [strokeWidth]="2" />{{ v.sede }}</span>
                    }
                    @if (v.tipoVinculacion) {
                      <span><app-icon name="briefcase" [size]="14" [strokeWidth]="2" />{{ v.tipoVinculacion }}</span>
                    }
                    <span><app-icon name="users" [size]="14" [strokeWidth]="2" />{{ v.plazas || 1 }} {{ (v.plazas || 1) == 1 ? 'plaza' : 'plazas' }}</span>
                  </div>
                  <div class="cand-vacante__pie">
                    <div class="cand-vacante__cierre">
                      Cierra el
                      <strong>{{ fecha(v.fechaCierre) || 'Sin fecha definida' }}{{ v.fechaCierre && v.horaCierre ? ' · ' + v.horaCierre : '' }}</strong>
                      @if (aviso(v); as texto) {
                        <span class="cand-aviso">{{ texto }}</span>
                      }
                    </div>
                    @if (postulacionDe(v.id); as p) {
                      <a [routerLink]="['/mis-postulaciones']" [queryParams]="{ radicado: p.radicado }" class="btn btn-secondary btn-sm">Ver mi postulación</a>
                    } @else {
                      <a [routerLink]="['/vacante', v.id]" class="btn btn-primary btn-sm">Ver detalles</a>
                    }
                  </div>
                </article>
              }
            </div>
          }
        }
      }
    </main>
  `,
})
export class ListaVacantesPage {
  private readonly auth = inject(AuthService);
  protected readonly fecha = formatearFecha;
  protected readonly aviso = avisoCierre;
  protected readonly vacantes = signal<any[] | null>(null);
  protected readonly error = signal('');
  protected readonly busqueda = signal('');
  private readonly misPostulaciones = signal<any[]>([]);
  private readonly porVacante = computed(() => {
    const mapa: Record<string, any> = {};
    // Una postulación retirada no cuenta como "ya te postulaste".
    for (const p of this.misPostulaciones()) if (p.estado !== 'Retirada') mapa[p.vacanteId] = p;
    return mapa;
  });

  constructor() {
    vacantesApi
      .listarPublicas()
      .then((v) => this.vacantes.set(v))
      .catch(() => this.error.set('No se pudieron cargar las vacantes. Intenta de nuevo en un momento.'));

    if (this.esCandidato()) {
      solicitudesApi
        .misSolicitudes(this.auth.token())
        .then((p) => this.misPostulaciones.set(p))
        .catch(() => {
          // Sin este dato la lista se muestra igual, solo sin el aviso "Ya te postulaste".
        });
    }
  }

  protected esCandidato(): boolean {
    return !!this.auth.token() && this.auth.usuario()?.rol === 'candidato';
  }

  protected postulacionDe(vacanteId: string): any {
    return this.porVacante()[vacanteId] || null;
  }

  protected esNueva(v: any): boolean {
    const dias = diasDesdePublicacion(v.fechaCreacion);
    return dias !== null && dias <= 3;
  }

  protected filtradas(): any[] {
    const busqueda = this.busqueda().trim().toLowerCase();
    return (this.vacantes() || []).filter((v) => {
      if (!busqueda) return true;
      const texto = `${v.cargo} ${v.descripcion || ''} ${v.procesoNo} ${v.sede || ''} ${v.area || ''}`.toLowerCase();
      return texto.includes(busqueda);
    });
  }
}
