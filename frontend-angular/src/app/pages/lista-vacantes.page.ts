import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocHeader } from '../components/doc-header';
import * as vacantesApi from '../lib/api/vacantesApi';

function textoPublicacion(fechaCreacion: string | null | undefined): string | null {
  if (!fechaCreacion) return null;

  const publicada = new Date(fechaCreacion);
  if (Number.isNaN(publicada.getTime())) return null;

  const inicioPublicada = new Date(publicada.getFullYear(), publicada.getMonth(), publicada.getDate());
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const dias = Math.round((inicioHoy.getTime() - inicioPublicada.getTime()) / 86400000);

  if (dias <= 0) return 'Publicado hoy';
  if (dias === 1) return 'Publicado hace 1 día';
  return `Publicado hace ${dias} días`;
}

import { CampoAccesible } from '../shared/campo-accesible';

import { formatearFecha } from '../lib/formato';

@Component({
  selector: 'app-lista-vacantes-page',
  imports: [CampoAccesible, RouterLink, DocHeader],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Convocatorias abiertas" />
    <main class="page">
      @if (error()) {
        <div class="card"><div class="notice notice--danger">{{ error() }}</div></div>
      }

      @if (!error() && vacantes() === null) {
        <div class="card"><p class="text-muted">Cargando…</p></div>
      }

      @if (vacantes() && vacantes()!.length > 0) {
        <div class="field" style="max-width: 360px; margin-bottom: 18px">
          <input type="search" aria-label="Buscar vacantes" autocomplete="off" placeholder="Buscar por cargo o palabra clave…" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
        </div>
      }

      @if (vacantes() && vacantes()!.length === 0) {
        <div class="card">
          <div class="empty-state">No hay convocatorias abiertas en este momento.</div>
        </div>
      }

      @if (vacantes() && vacantes()!.length > 0 && filtradas().length === 0) {
        <div class="card">
          <div class="empty-state">Ninguna vacante coincide con "{{ busqueda() }}".</div>
        </div>
      }

      @if (filtradas().length > 0) {
        <div class="vac-grid">
          @for (v of filtradas(); track v.id) {
            <div class="vac-card">
              <div class="vac-card__body">
                <div class="vac-card__proceso">Proceso {{ v.procesoNo }}</div>
                <div class="vac-card__cargo">{{ v.cargo }}</div>
                @if (v.descripcion) {
                  <p class="text-muted" style="font-size: 13px; margin: 4px 0 0">{{ v.descripcion }}</p>
                }
                <div class="vac-card__meta">
                  <span><b>Plazas:</b> {{ v.plazas || '—' }}</span>
                  <span><b>Cierra:</b> {{ fecha(v.fechaCierre) || '—' }} {{ v.horaCierre || '' }}</span>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap">
                  @if (textoPublicacion(v.fechaCreacion); as publicacion) {
                    <span class="vac-status-pill vac-status-pill--activa vac-card__publicado">{{ publicacion }}</span>
                  }
                  <span
                    class="vac-status-pill vac-card__publicado"
                    [class.vac-status-pill--cerrada]="v.estaCerrada"
                    [class.vac-status-pill--oculta]="!v.estaCerrada && v.aunNoAbre"
                    [class.vac-status-pill--en-proceso]="!v.estaCerrada && !v.aunNoAbre"
                  >
                    {{ v.estaCerrada ? 'Cerrada' : v.aunNoAbre ? 'Abre el ' + fecha(v.fechaApertura) : 'Abierta' }}
                  </span>
                </div>
              </div>
              <div class="vac-card__action">
                @if (v.estaCerrada) {
                  <span class="vac-status-pill vac-status-pill--cerrada">Convocatoria cerrada</span>
                } @else {
                  <a [routerLink]="['/vacante', v.id]" class="btn btn-primary">Ver detalles</a>
                }
              </div>
            </div>
          }
        </div>
      }
    </main>
  `,
})
export class ListaVacantesPage {
  protected readonly fecha = formatearFecha;
  protected readonly vacantes = signal<any[] | null>(null);
  protected readonly error = signal('');
  protected readonly busqueda = signal('');
  protected readonly textoPublicacion = textoPublicacion;

  constructor() {
    vacantesApi
      .listarPublicas()
      .then((v) => this.vacantes.set(v))
      .catch(() => this.error.set('No se pudieron cargar las vacantes. Intenta de nuevo en un momento.'));
  }

  protected filtradas(): any[] {
    const busqueda = this.busqueda();
    return (this.vacantes() || []).filter((v) => {
      if (!busqueda.trim()) return true;
      const texto = `${v.cargo} ${v.descripcion || ''} ${v.procesoNo}`.toLowerCase();
      return texto.includes(busqueda.toLowerCase());
    });
  }
}
