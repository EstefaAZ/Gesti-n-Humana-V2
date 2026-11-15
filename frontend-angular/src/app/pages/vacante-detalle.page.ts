import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DocHeader } from '../components/doc-header';
import * as vacantesApi from '../lib/api/vacantesApi';
import * as solicitudesApi from '../lib/api/solicitudesApi';
import * as perfilesApi from '../lib/api/perfilesApi';
import { archivoABase64 } from '../lib/formState';
import { etiquetaNivelIdioma, normalizarNivelIdioma } from '../data/catalogos';
import { AuthService } from '../core/auth.service';
import { ApiError } from '../lib/api/httpClient';

const CATEGORIAS_EXTRA = [
  { clave: 'certificadosLaborales', etiqueta: 'Certificados laborales adicionales' },
  { clave: 'certificadosEstudio', etiqueta: 'Certificados de estudio y/o cursos adicionales' },
  { clave: 'tarjetaProfesional', etiqueta: 'Tarjeta profesional (si no la subiste en tu perfil)' },
];

import { CampoAccesible } from '../shared/campo-accesible';

import { formatearFecha } from '../lib/formato';

@Component({
  selector: 'app-vacante-detalle-page',
  imports: [CampoAccesible, RouterLink, DocHeader],
  host: { style: 'display: contents' },
  template: `
    @if (error()) {
      <app-doc-header title="Error" />
      <main class="page"><div class="card"><div class="notice notice--danger">{{ error() }}</div></div></main>
    } @else if (vacante() === undefined) {
      <!-- cargando -->
    } @else if (!vacante()) {
      <app-doc-header title="Vacante no encontrada" />
      <main class="page">
        <div class="card">
          <div class="empty-state">No encontramos esta vacante. Puede que ya no esté disponible.</div>
        </div>
      </main>
    } @else {
      <app-doc-header [title]="vacante().cargo" />
      <main class="page">
        <div class="card mt-24">
          <div class="vac-card__proceso">Proceso de Selección No. {{ vacante().procesoNo }}</div>
          <h2 class="section-title" style="margin-top: 4px">{{ vacante().cargo }}</h2>
          @if (vacante().descripcion) {
            <p style="font-size: 14px; color: var(--color-text); margin: 4px 0 16px">{{ vacante().descripcion }}</p>
          }

          <div class="field-grid" style="margin: 16px 0">
            <div class="info-box"><label>Proceso / Área</label><div class="value">{{ vacante().area || '—' }}</div></div>
            <div class="info-box"><label>Salario básico</label><div class="value">{{ vacante().salario || '—' }}</div></div>
            <div class="info-box"><label>Tipo de vinculación</label><div class="value">{{ vacante().tipoVinculacion || '—' }}</div></div>
            <div class="info-box"><label>N° de plazas</label><div class="value">{{ vacante().plazas || '—' }}</div></div>
            <div class="info-box"><label>Público objetivo</label><div class="value">{{ vacante().publicoObjetivo || '—' }}</div></div>
            <div class="info-box">
              <label>Fecha y hora de cierre</label>
              <div class="value">{{ fecha(vacante().fechaCierre) || '—' }} / {{ vacante().horaCierre || '' }}</div>
            </div>
          </div>

          @if (vacante().requisitosObligatorios) {
            <h3 class="section-title" style="font-size: 15px">Requisitos obligatorios</h3>
            <p class="text-muted">{{ vacante().requisitosObligatorios }}</p>
          }

          <h3 class="section-title" style="font-size: 15px">Requisitos evaluados en la inscripción</h3>
          <ul style="margin: 4px 0 14px 18px; padding: 0; font-size: 13.5px">
            @if (c().nivelEducativoMin) {
              <li>Nivel educativo mínimo: {{ c().nivelEducativoMin }} o superior{{ c().graduadoRequerido ? ' (graduado)' : '' }}</li>
            }
            @if (c().profesionKeyword) {
              <li>Profesión / título relacionado con: "{{ c().profesionKeyword }}"</li>
            }
            @if (c().experienciaMinAnios) {
              <li>Experiencia mínima: {{ c().experienciaMinAnios }} años</li>
            }
            @if (c().idiomaRequerido) {
              <li>Idioma: {{ c().idiomaRequerido }} — nivel mínimo {{ nivelIdiomaMin() }} o superior</li>
            }
            @for (cert of c().certificacionesKeywords || []; track $index) {
              <li>Certificación relacionada con: "{{ cert }}"</li>
            }
            @if (!c().nivelEducativoMin && !c().profesionKeyword && !c().experienciaMinAnios && !c().idiomaRequerido && (c().certificacionesKeywords || []).length === 0) {
              <li class="text-muted">Esta vacante no tiene requisitos específicos configurados.</li>
            }
          </ul>

          @if (vacante().conocimientosComplementarios) {
            <h3 class="section-title" style="font-size: 15px">Conocimientos complementarios</h3>
            <p class="text-muted">{{ vacante().conocimientosComplementarios }}</p>
          }

          @if (vacante().tieneDocumentoPdf) {
            <div class="field mt-24">
              <a [href]="urlDocumentoPdf()" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
                📄 Ver formato oficial de la convocatoria (PDF)
              </a>
            </div>
          }

          @if (errorInscripcion()) {
            <div class="notice notice--danger">{{ errorInscripcion() }}</div>
          }

          @if (mostrarConfirmacion() && !miPostulacion()) {
            <div style="border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-top: 20px">
              <h3 class="section-title" style="font-size: 15px">Confirmar inscripción</h3>
              @if (!perfil()) {
                <p class="text-muted">Cargando tu perfil…</p>
              } @else {
                <p style="font-size: 13.5px">
                  Vas a inscribirte con los datos de tu perfil: <strong>{{ perfil().datosPersonales?.nombreCompleto }}</strong>,
                  {{ perfil().registrosII?.length || 0 }} registro(s) de estudio y {{ perfil().experiencia?.length || 0 }} experiencia(s) laboral(es).
                  <a routerLink="/completar-perfil">¿Necesitas actualizar tu perfil?</a>
                </p>

                <p class="text-muted" style="font-size: 12.5px; margin-top: 16px">
                  Si esta vacante requiere alguna certificación adicional que no subiste en tu perfil, puedes adjuntarla aquí (opcional):
                </p>
                @for (cat of categoriasExtra; track cat.clave) {
                  <div class="field" style="margin-bottom: 14px">
                    <label>{{ cat.etiqueta }}</label>
                    @if (documentosExtra()[cat.clave].length > 0) {
                      <ul style="list-style: none; margin: 0 0 6px; padding: 0">
                        @for (doc of documentosExtra()[cat.clave]; track $index; let i = $index) {
                          <li style="font-size: 12.5px; display: flex; align-items: center; gap: 8px">
                            📄 {{ doc.nombre }}
                            <button type="button" class="hr-link-btn hr-link-btn--danger" (click)="quitarArchivoExtra(cat.clave, i)">Quitar</button>
                          </li>
                        }
                      </ul>
                    }
                    <input type="file" accept="application/pdf,image/*" (change)="onArchivoExtra(cat.clave, $event)" />
                  </div>
                }

                <div class="wizard-actions">
                  <button type="button" class="btn btn-secondary" (click)="mostrarConfirmacion.set(false)" [disabled]="inscribiendo()">Cancelar</button>
                  <button type="button" class="btn btn-primary" (click)="confirmarInscripcion()" [disabled]="inscribiendo()">
                    {{ inscribiendo() ? 'Enviando…' : 'Confirmar inscripción' }}
                  </button>
                </div>
              }
            </div>
          }

          <div class="wizard-actions" style="justify-content: flex-end">
            @if (miPostulacion()) {
              <div class="notice notice--info" style="margin: 0">
                Ya te inscribiste a esta vacante (radicado <strong>{{ miPostulacion().radicado }}</strong>).
              </div>
            } @else if (vacante().estaCerrada) {
              <div class="notice notice--danger" style="margin: 0">
                Esta convocatoria cerró el {{ fecha(vacante().fechaCierre) }} a las {{ vacante().horaCierre }}. Ya no se reciben inscripciones.
              </div>
            } @else if (vacante().aunNoAbre) {
              <div class="notice notice--info" style="margin: 0">
                Esta convocatoria abre el <strong>{{ fecha(vacante().fechaApertura) }}</strong>. Vuelve ese día para poder inscribirte.
              </div>
            } @else if (esGestion()) {
              <!-- Gestión Humana / admin no se inscriben -->
            } @else if (!mostrarConfirmacion()) {
              <button type="button" class="btn btn-primary" (click)="abrirConfirmacion()">Inscribirme</button>
            }
          </div>
        </div>
      </main>
    }
  `,
})
export class VacanteDetallePage {
  protected readonly fecha = formatearFecha;
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  protected readonly vacante = signal<any>(undefined); // undefined = cargando, null = no encontrada
  protected readonly error = signal('');
  protected readonly miPostulacion = signal<any>(undefined); // undefined = cargando, null = no se ha postulado
  protected readonly mostrarConfirmacion = signal(false);
  protected readonly perfil = signal<any>(null);
  protected readonly documentosExtra = signal<any>({ cedula: [], certificadosLaborales: [], certificadosEstudio: [], tarjetaProfesional: [] });
  protected readonly inscribiendo = signal(false);
  protected readonly errorInscripcion = signal('');
  protected readonly categoriasExtra = CATEGORIAS_EXTRA;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      vacantesApi
        .obtenerPublica(id)
        .then((v) => this.vacante.set(v))
        .catch((e) => (e.status === 404 ? this.vacante.set(null) : this.error.set('No se pudo cargar la vacante.')));

      const token = this.auth.token();
      if (!token) return;
      solicitudesApi
        .misSolicitudes(token)
        .then((mias) => this.miPostulacion.set(mias.find((s: any) => s.vacanteId === id) || null))
        .catch(() => this.miPostulacion.set(null));
    });
  }

  protected c(): any {
    return this.vacante()?.criterios || {};
  }

  protected nivelIdiomaMin(): string {
    return etiquetaNivelIdioma(normalizarNivelIdioma(this.c().idiomaNivelMin));
  }

  protected esGestion(): boolean {
    const rol = this.auth.usuario()?.rol;
    return rol === 'gestor_humano' || rol === 'admin';
  }

  protected urlDocumentoPdf(): string {
    return vacantesApi.urlDocumentoPdf(this.vacante().id);
  }

  protected abrirConfirmacion(): void {
    this.mostrarConfirmacion.set(true);
    if (!this.perfil()) {
      perfilesApi
        .obtenerMiPerfil(this.auth.token())
        .then((p) => this.perfil.set(p))
        .catch(() => {});
    }
  }

  protected onArchivoExtra(clave: string, e: Event): void {
    const inputEl = e.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    this.agregarArchivoExtra(clave, file);
  }

  private async agregarArchivoExtra(clave: string, file: File | undefined): Promise<void> {
    if (!file) return;
    const contenidoBase64 = await archivoABase64(file);
    this.documentosExtra.update((prev) => ({ ...prev, [clave]: [...prev[clave], { nombre: file.name, contenidoBase64 }] }));
  }

  protected quitarArchivoExtra(clave: string, indice: number): void {
    this.documentosExtra.update((prev) => ({ ...prev, [clave]: prev[clave].filter((_: any, i: number) => i !== indice) }));
  }

  protected async confirmarInscripcion(): Promise<void> {
    this.errorInscripcion.set('');
    this.inscribiendo.set(true);
    try {
      const solicitud = await solicitudesApi.inscribirme(this.vacante().id, this.documentosExtra(), this.auth.token());
      this.miPostulacion.set(solicitud);
      this.mostrarConfirmacion.set(false);
    } catch (e: any) {
      if (e instanceof ApiError) {
        this.errorInscripcion.set(e.detail || 'No se pudo completar la inscripción.');
      } else {
        this.errorInscripcion.set('No se pudo completar la inscripción. Intenta de nuevo.');
      }
    } finally {
      this.inscribiendo.set(false);
    }
  }
}
