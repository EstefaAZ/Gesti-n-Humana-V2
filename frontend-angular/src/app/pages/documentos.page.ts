import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocHeader } from '../components/doc-header';
import { Icon } from '../shared/icon';
import { AuthService } from '../core/auth.service';
import * as perfilesApi from '../lib/api/perfilesApi';
import * as solicitudesApi from '../lib/api/solicitudesApi';
import { CATEGORIAS_DOCUMENTOS } from '../lib/api/solicitudesApi';
import { pesoDeBase64, pesoLegible } from '../components/zona-archivos';
import { BotonDescargarTodos } from '../components/boton-descargar-todos';

@Component({
  selector: 'app-documentos-page',
  imports: [RouterLink, DocHeader, Icon, BotonDescargarTodos],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Documentos" />
    <main class="page">
      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      }

      @if (perfil() === undefined) {
        <div class="ps-tarjeta cand-vacio"><p class="text-muted" style="margin: 0">Cargando tus documentos…</p></div>
      } @else {
        <section class="ps-tarjeta cand-seccion" aria-labelledby="docs-perfil">
          <div class="cand-seccion__cabecera">
            <div>
              <h2 class="cand-seccion__titulo" id="docs-perfil">Documentos de tu perfil</h2>
              <p class="cand-seccion__sub">Se envían automáticamente cada vez que te postulas a una vacante.</p>
            </div>
            @if (perfil()) {
              <div class="cand-seccion__acciones">
                @if (categoriasCompletas() > 0) {
                  <app-boton-descargar-todos [descargar]="descargarPerfilZip" />
                }
                <a routerLink="/completar-perfil" class="btn btn-secondary btn-sm"><app-icon name="lapiz" [size]="14" [strokeWidth]="2" /> Actualizar documentos</a>
              </div>
            }
          </div>

          @if (!perfil()) {
            <div class="cand-vacio" style="padding: 24px 12px">
              <span class="cand-vacio__icono" aria-hidden="true"><app-icon name="documento" [size]="22" [strokeWidth]="1.8" /></span>
              <p class="cand-vacio__titulo">Todavía no has completado tu perfil</p>
              <p class="cand-vacio__texto">Al completarlo adjuntas tu cédula, certificados y tarjeta profesional una sola vez.</p>
              <a routerLink="/completar-perfil" class="btn btn-primary btn-sm">Completar mi perfil</a>
            </div>
          } @else {
            <div class="cand-progreso">
              <div class="cand-progreso__barra" aria-hidden="true"><span [style.width.%]="(categoriasCompletas() / categorias.length) * 100"></span></div>
              <span><strong style="color: var(--color-text)">{{ categoriasCompletas() }} de {{ categorias.length }}</strong> tipos de documento adjuntados</span>
            </div>

            <div class="cand-docs">
              @for (cat of categorias; track cat.clave) {
                <div class="cand-doc" [class.is-falta]="archivosPerfil(cat.clave).length === 0">
                  <div class="cand-doc__top">
                    <p class="cand-doc__nombre">{{ cat.etiqueta }}</p>
                    @if (archivosPerfil(cat.clave).length > 0) {
                      <span class="cand-pildora cand-pildora--ok"><app-icon name="check" [size]="12" [strokeWidth]="2.6" /> {{ archivosPerfil(cat.clave).length }}</span>
                    } @else {
                      <span class="cand-pildora cand-pildora--falta">Falta</span>
                    }
                  </div>
                  @if (archivosPerfil(cat.clave).length === 0) {
                    <p class="cand-doc__vacio">Sin adjuntar · hasta {{ cat.max }} {{ cat.max === 1 ? 'archivo' : 'archivos' }}.</p>
                  } @else {
                    <ul class="archivos-lista">
                      @for (doc of archivosPerfil(cat.clave); track $index; let i = $index) {
                        <li class="archivo-item">
                          <span class="archivo-item__icono" aria-hidden="true"><app-icon name="documento" [size]="16" [strokeWidth]="1.8" /></span>
                          <span class="archivo-item__texto">
                            <span class="archivo-item__nombre" [title]="doc.nombre">{{ doc.nombre }}</span>
                            @if (peso(doc)) {
                              <span class="archivo-item__detalle">{{ peso(doc) }}</span>
                            }
                          </span>
                          <button type="button" class="hr-link-btn" [attr.aria-label]="'Descargar ' + doc.nombre" (click)="descargarMiDocumento(cat.claveApi, i, doc.nombre)">
                            <app-icon name="descargar" [size]="16" [strokeWidth]="2" />
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            </div>
          }
        </section>

        @if (postulaciones().length > 0) {
          <section class="ps-tarjeta cand-seccion" aria-labelledby="docs-postulaciones">
            <div class="cand-seccion__cabecera">
              <div>
                <h2 class="cand-seccion__titulo" id="docs-postulaciones">Documentos enviados por postulación</h2>
                <p class="cand-seccion__sub">Lo que recibió Gestión Humana en cada proceso: los de tu perfil en ese momento y las certificaciones extra que adjuntaste para esa vacante.</p>
              </div>
            </div>
            <div class="cand-envios">
              @for (p of postulaciones(); track p.radicado) {
                <details class="cand-envio">
                  <summary>
                    <span style="min-width: 0">
                      <span class="cand-envio__titulo">{{ p.vacanteCargo || 'Vacante' }}</span>
                      <span class="cand-envio__meta">Radicado {{ p.radicado }} · {{ totalArchivos(p) }} {{ totalArchivos(p) === 1 ? 'archivo' : 'archivos' }}</span>
                    </span>
                    <span class="cand-envio__flecha" aria-hidden="true"><app-icon name="chevronAbajo" [size]="18" [strokeWidth]="2" /></span>
                  </summary>
                  <div class="cand-envio__cuerpo">
                    @if (totalArchivos(p) === 0) {
                      <p class="cand-doc__vacio">Esta postulación no tiene documentos adjuntos.</p>
                    } @else {
                      <div><app-boton-descargar-todos [descargar]="descargarPostulacionZip(p)" /></div>
                    }
                    @for (cat of categorias; track cat.clave) {
                      @if ((p.documentosAdjuntos?.[cat.clave] || []).length > 0) {
                        <div>
                          <p class="cand-envio__categoria">{{ cat.etiqueta }}</p>
                          <ul class="archivos-lista">
                            @for (doc of p.documentosAdjuntos[cat.clave]; track $index; let i = $index) {
                              <li class="archivo-item">
                                <span class="archivo-item__icono" aria-hidden="true"><app-icon name="documento" [size]="16" [strokeWidth]="1.8" /></span>
                                <span class="archivo-item__texto"><span class="archivo-item__nombre" [title]="doc.nombre">{{ doc.nombre }}</span></span>
                                <button type="button" class="hr-link-btn" [attr.aria-label]="'Descargar ' + doc.nombre" (click)="descargarDocumentoAdjunto(p.radicado, cat.claveApi, i, doc.nombre)">
                                  <app-icon name="descargar" [size]="16" [strokeWidth]="2" />
                                </button>
                              </li>
                            }
                          </ul>
                        </div>
                      }
                    }
                  </div>
                </details>
              }
            </div>
          </section>
        }
      }
    </main>
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

  protected categoriasCompletas(): number {
    return this.categorias.filter((c) => this.archivosPerfil(c.clave).length > 0).length;
  }

  protected totalArchivos(p: any): number {
    return this.categorias.reduce((total, c) => total + (p.documentosAdjuntos?.[c.clave] || []).length, 0);
  }

  protected peso(doc: any): string {
    return pesoLegible(pesoDeBase64(doc?.contenidoBase64));
  }

  protected readonly descargarPerfilZip = () => {
    const nombre = this.perfil()?.datosPersonales?.nombreCompleto || 'mi perfil';
    return perfilesApi.descargarMisDocumentosZip(`Documentos - ${nombre}.zip`, this.auth.token());
  };

  protected descargarPostulacionZip(p: any): () => Promise<unknown> {
    return () => solicitudesApi.descargarDocumentosZip(p.radicado, `${p.radicado} - ${p.vacanteCargo || 'documentos'}.zip`, this.auth.token());
  }

  protected descargarMiDocumento(categoriaApi: string, indice: number, nombre: string): void {
    perfilesApi.descargarMiDocumento(categoriaApi, indice, nombre, this.auth.token());
  }

  protected descargarDocumentoAdjunto(radicado: string, categoriaApi: string, indice: number, nombre: string): void {
    solicitudesApi.descargarDocumentoAdjunto(radicado, categoriaApi, indice, nombre, this.auth.token());
  }
}
