import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocHeader } from '../components/doc-header';
import { AuthService } from '../core/auth.service';
import * as perfilesApi from '../lib/api/perfilesApi';
import * as solicitudesApi from '../lib/api/solicitudesApi';
import { CATEGORIAS_DOCUMENTOS } from '../lib/api/solicitudesApi';

@Component({
  selector: 'app-documentos-page',
  imports: [RouterLink, DocHeader],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Documentos" [showCode]="false" />
    @if (perfil() === undefined) {
      <main class="page"><p class="text-muted">Cargando…</p></main>
    } @else {
      <main class="page">
        @if (error()) {
          <div class="notice notice--danger">{{ error() }}</div>
        }

        <div class="card">
          <h2 class="section-title" style="font-size: 16px">Documentos de tu perfil</h2>
          @if (!perfil()) {
            <p class="text-muted">Todavía no has completado tu perfil. <a routerLink="/completar-perfil">Completarlo ahora →</a></p>
          } @else {
            @for (cat of categorias; track cat.clave) {
              <div style="margin-bottom: 12px">
                <span style="font-size: 13px; font-weight: 600">{{ cat.etiqueta }}: </span>
                @if (archivosPerfil(cat.clave).length === 0) {
                  <span class="text-muted" style="font-size: 13px">sin adjuntar</span>
                } @else {
                  @for (doc of archivosPerfil(cat.clave); track $index; let i = $index) {
                    <button type="button" class="hr-link-btn" style="margin-right: 10px" (click)="descargarMiDocumento(cat.claveApi, i, doc.nombre)">
                      📄 {{ doc.nombre }}
                    </button>
                  }
                }
              </div>
            }
          }
          @if (perfil()) {
            <p class="text-muted mt-24" style="font-size: 12px">¿Necesitas actualizar alguno? <a routerLink="/completar-perfil">Edita tu perfil</a>.</p>
          }
        </div>

        @if (postulaciones().length > 0) {
          <div class="card mt-24">
            <h2 class="section-title" style="font-size: 16px">Documentos por postulación</h2>
            <p class="text-muted" style="font-size: 12.5px; margin-top: -4px">
              Incluye los de tu perfil más cualquier certificación extra que hayas adjuntado para esa vacante en particular.
            </p>
            @for (p of postulaciones(); track p.radicado) {
              <div style="border-top: 1px solid var(--color-border); padding-top: 14px; margin-top: 14px">
                <p style="font-size: 13.5px; font-weight: 600; margin: 0 0 8px">
                  {{ p.vacanteCargo || p.vacanteId }} <span class="text-muted" style="font-weight: 400">({{ p.radicado }})</span>
                </p>
                @for (cat of categorias; track cat.clave) {
                  @if ((p.documentosAdjuntos?.[cat.clave] || []).length > 0) {
                    <div style="margin-bottom: 8px">
                      <span style="font-size: 12.5px; color: var(--color-text-muted)">{{ cat.etiqueta }}: </span>
                      @for (doc of p.documentosAdjuntos[cat.clave]; track $index; let i = $index) {
                        <button
                          type="button"
                          class="hr-link-btn"
                          style="margin-right: 10px; font-size: 12.5px"
                          (click)="descargarDocumentoAdjunto(p.radicado, cat.claveApi, i, doc.nombre)"
                        >
                          📄 {{ doc.nombre }}
                        </button>
                      }
                    </div>
                  }
                }
              </div>
            }
          </div>
        }
      </main>
    }
  `,
})
export class DocumentosPage {
  private readonly auth = inject(AuthService);
  protected readonly perfil = signal<any>(undefined); // undefined = cargando, null = sin perfil
  protected readonly postulaciones = signal<any[]>([]);
  protected readonly error = signal('');
  protected readonly categorias = CATEGORIAS_DOCUMENTOS;

  constructor() {
    const token = this.auth.token();
    perfilesApi
      .obtenerMiPerfil(token)
      .then((p) => this.perfil.set(p))
      .catch(() => this.perfil.set(null));

    solicitudesApi
      .misSolicitudes(token)
      .then((p) => this.postulaciones.set(p))
      .catch(() => this.error.set('No se pudieron cargar tus postulaciones.'));
  }

  protected archivosPerfil(clave: string): any[] {
    return this.perfil()?.documentosAdjuntos?.[clave] || [];
  }

  protected descargarMiDocumento(categoriaApi: string, indice: number, nombre: string): void {
    perfilesApi.descargarMiDocumento(categoriaApi, indice, nombre, this.auth.token());
  }

  protected descargarDocumentoAdjunto(radicado: string, categoriaApi: string, indice: number, nombre: string): void {
    solicitudesApi.descargarDocumentoAdjunto(radicado, categoriaApi, indice, nombre, this.auth.token());
  }
}
