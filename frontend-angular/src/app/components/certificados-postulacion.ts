import { Component, OnChanges, SimpleChanges, computed, inject, input, output, signal } from '@angular/core';
import { Icon } from '../shared/icon';
import { ZonaArchivos, pesoDeBase64, pesoLegible } from './zona-archivos';
import { AuthService } from '../core/auth.service';
import * as solicitudesApi from '../lib/api/solicitudesApi';
import { textoPlazo } from '../lib/api/solicitudesApi';
import { archivoABase64 } from '../lib/formState';
import { ApiError } from '../lib/api/httpClient';

const CATEGORIAS = [
  { clave: 'certificadosLaborales', etiqueta: 'Certificados laborales', ayuda: 'Con funciones y fechas de inicio y terminación de cada cargo.' },
  { clave: 'certificadosEstudio', etiqueta: 'Certificados de estudio y/o cursos', ayuda: 'Diplomas, actas de grado y certificados de cursos.' },
] as const;
type Clave = (typeof CATEGORIAS)[number]['clave'];

const MAX_POR_CATEGORIA = 10;
const MAX_MB = 5;

/**
 * Certificados laborales y de estudio de UNA postulación, en "Mis
 * postulaciones". Solo aparece cuando Gestión Humana preselecciona al
 * candidato; tiene 3 días hábiles para adjuntarlos. Se guardan solo en esta
 * postulación, no en el perfil.
 */
@Component({
  selector: 'app-certificados-postulacion',
  imports: [Icon, ZonaArchivos],
  host: { style: 'display: contents' },
  template: `
    @if (c(); as cert) {
      <section class="cert" [class.is-pendiente]="cert.estado === 'pendientes'" [class.is-vencido]="cert.estado === 'vencidos'" aria-label="Certificados laborales y de estudio">
        <div class="cert__cabecera">
          <span class="cert__icono" aria-hidden="true">
            <app-icon [name]="cert.estado === 'recibidos' ? 'check' : 'documento'" [size]="17" [strokeWidth]="2.2" />
          </span>
          <div class="cert__texto">
            @switch (cert.estado) {
              @case ('pendientes') {
                <p class="cert__titulo">Pasaste a la siguiente etapa del proceso de selección, adjunta tus certificados</p>
                <p class="cert__sub">Tienes hasta el <strong>{{ plazo() }}</strong> a las 11:59 p. m. para adjuntar tus certificados laborales y de estudio.</p>
              }
              @case ('recibidos') {
                <p class="cert__titulo">Certificados enviados</p>
                <p class="cert__sub">
                  Gestión Humana ya los puede revisar.
                  @if (cert.puedeAdjuntar) { Puedes agregar o cambiar archivos hasta el {{ plazo() }}. }
                </p>
              }
              @case ('vencidos') {
                <p class="cert__titulo">Venció el plazo para adjuntar tus certificados</p>
                <p class="cert__sub">El plazo era el {{ plazo() }}. Si necesitas más tiempo, escribe a Gestión Humana.</p>
              }
            }
          </div>
        </div>

        @if (cert.puedeAdjuntar) {
          @if (!editando() && cert.estado === 'recibidos') {
            <ul class="cert__resumen">
              @for (cat of categorias; track cat.clave) {
                <li><strong>{{ cat.etiqueta }}:</strong> {{ archivos(cat.clave).length || 'ninguno' }}</li>
              }
            </ul>
            <button type="button" class="btn btn-secondary btn-sm" (click)="editando.set(true)">Agregar o cambiar archivos</button>
          } @else {
            @for (cat of categorias; track cat.clave) {
              <div class="field cert__categoria">
                <label>{{ cat.etiqueta }} <span class="hint">({{ archivos(cat.clave).length }}/{{ maxPorCategoria }})</span></label>
                <span class="hint">{{ cat.ayuda }}</span>
                @if (archivos(cat.clave).length > 0) {
                  <ul class="archivos-lista">
                    @for (doc of archivos(cat.clave); track $index; let i = $index) {
                      <li class="archivo-item">
                        <span class="archivo-item__icono" aria-hidden="true"><app-icon name="documento" [size]="16" [strokeWidth]="1.8" /></span>
                        <span class="archivo-item__texto">
                          <span class="archivo-item__nombre" [title]="doc.nombre">{{ doc.nombre }}</span>
                          <span class="archivo-item__detalle">{{ doc.contenidoBase64 ? peso(doc) + ' · se enviará al guardar' : 'Ya enviado' }}</span>
                        </span>
                        <button type="button" class="hr-link-btn hr-link-btn--danger" [attr.aria-label]="'Quitar ' + doc.nombre" (click)="quitar(cat.clave, i)">Quitar</button>
                      </li>
                    }
                  </ul>
                }
                @if (archivos(cat.clave).length < maxPorCategoria) {
                  <app-zona-archivos
                    accept="application/pdf,image/*"
                    multiple
                    textoTipos="PDF o imagen, máximo 5 MB por archivo"
                    [textoBoton]="archivos(cat.clave).length > 0 ? 'Agregar otro' : 'Elegir archivos'"
                    [etiqueta]="cat.etiqueta"
                    (archivos)="agregar(cat.clave, $event)"
                  />
                }
              </div>
            }
            @if (error()) {
              <div class="notice notice--danger" role="alert">{{ error() }}</div>
            }
            <div class="cert__acciones">
              @if (cert.estado === 'recibidos') {
                <button type="button" class="btn btn-secondary btn-sm" (click)="cancelar()" [disabled]="enviando()">Cancelar</button>
              }
              <button type="button" class="btn btn-primary btn-sm" (click)="enviar()" [disabled]="enviando() || total() === 0 || !hayCambios()">
                {{ enviando() ? 'Enviando…' : 'Enviar certificados' }}
              </button>
            </div>
          }
        }
      </section>
    }
  `,
})
export class CertificadosPostulacion implements OnChanges {
  private readonly auth = inject(AuthService);
  readonly postulacion = input.required<any>();
  readonly actualizada = output<any>();

  protected readonly categorias = CATEGORIAS;
  protected readonly maxPorCategoria = MAX_POR_CATEGORIA;
  protected readonly peso = (doc: any) => pesoLegible(pesoDeBase64(doc.contenidoBase64));

  protected readonly c = computed(() => this.postulacion().certificados);
  protected readonly plazo = computed(() => textoPlazo(this.c()?.plazo));

  /** Lo que el candidato tiene armado: ya enviados (solo nombre) + nuevos (con contenido). */
  private readonly borrador = signal<Record<Clave, any[]>>({ certificadosLaborales: [], certificadosEstudio: [] });
  protected readonly editando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly total = computed(() => this.borrador().certificadosLaborales.length + this.borrador().certificadosEstudio.length);
  protected readonly hayCambios = computed(() => {
    const docs = this.postulacion().documentosAdjuntos || {};
    return CATEGORIAS.some(({ clave }) => {
      const antes = (docs[clave] || []).map((d: any) => d.nombre).join('|');
      const ahora = this.borrador()[clave].map((d: any) => (d.contenidoBase64 ? '+' : '') + d.nombre).join('|');
      return antes !== ahora;
    });
  });

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['postulacion']) this.reiniciar();
  }

  protected archivos(clave: Clave): any[] {
    return this.borrador()[clave];
  }

  private reiniciar(): void {
    const docs = this.postulacion().documentosAdjuntos || {};
    this.borrador.set({
      certificadosLaborales: (docs.certificadosLaborales || []).map((d: any) => ({ nombre: d.nombre })),
      certificadosEstudio: (docs.certificadosEstudio || []).map((d: any) => ({ nombre: d.nombre })),
    });
    this.error.set('');
  }

  protected cancelar(): void {
    this.reiniciar();
    this.editando.set(false);
  }

  protected async agregar(clave: Clave, files: File[]): Promise<void> {
    this.error.set('');
    for (const file of files) {
      if (this.borrador()[clave].length >= MAX_POR_CATEGORIA) {
        this.error.set(`Puedes adjuntar hasta ${MAX_POR_CATEGORIA} archivos por tipo de certificado.`);
        break;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        this.error.set(`"${file.name}" pesa más de ${MAX_MB} MB.`);
        continue;
      }
      const contenidoBase64 = await archivoABase64(file);
      this.borrador.update((b) => ({ ...b, [clave]: [...b[clave], { nombre: file.name, contenidoBase64 }] }));
    }
  }

  protected quitar(clave: Clave, indice: number): void {
    this.borrador.update((b) => ({ ...b, [clave]: b[clave].filter((_: any, i: number) => i !== indice) }));
  }

  protected async enviar(): Promise<void> {
    this.enviando.set(true);
    this.error.set('');
    try {
      const actualizada = await solicitudesApi.guardarCertificados(this.postulacion().radicado, this.borrador(), this.auth.token());
      this.editando.set(false);
      this.actualizada.emit(actualizada);
    } catch (err: any) {
      this.error.set(err instanceof ApiError ? err.detail : 'No se pudieron enviar los certificados. Intenta de nuevo.');
    } finally {
      this.enviando.set(false);
    }
  }
}
