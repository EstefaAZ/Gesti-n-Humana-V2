import { Component, OnInit, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NIVELES_EDUCATIVOS, NIVELES_IDIOMA, IDIOMAS, TIPOS_VINCULACION, PUBLICO_OBJETIVO_OPCIONES, etiquetaNivelIdioma } from '../../data/catalogos';
import { formatearMilesCOP } from '../../lib/formato';
import { normalizarVacanteParaFormulario } from '../../lib/vacanteDefaults';
import { SelectConOtro } from '../../components/select-con-otro';

const ESTADOS = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'publicada', etiqueta: 'Publicada' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'cerrada', etiqueta: 'Cerrada' },
  { valor: 'cancelada_desierta', etiqueta: 'Cancelada / Desierta' },
];

const MAX_CERTIFICACIONES = 5;

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  selector: 'app-vacante-form',
  imports: [CampoAccesible, FormsModule, SelectConOtro],
  host: { style: 'display: contents' },
  template: `
    @if (v(); as v) {
      <div class="card">
        <h2 class="section-title">{{ vacanteInicial().id && vacanteInicial()._editando ? 'Editar vacante' : 'Nueva vacante' }}</h2>

        <fieldset style="border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px">
          <legend style="font-weight: 700; color: var(--color-primary-dark); padding: 0 6px">Información de la convocatoria (GTH-FOR-02)</legend>
          <div class="field-grid">
            <div class="field">
              <label>Proceso de selección No. *</label>
              <input type="text" [value]="v.procesoNo" (input)="setCampo('procesoNo', $event)" />
            </div>
            <div class="field field--span2">
              <label>Cargo *</label>
              <input type="text" [value]="v.cargo" (input)="setCampo('cargo', $event)" />
            </div>
            <div class="field field--span2">
              <label>Descripción breve (la verá el candidato en el listado y el detalle de la vacante)</label>
              <textarea
                [value]="v.descripcion"
                (input)="setCampo('descripcion', $event)"
                placeholder="Ej: Buscamos un perfil analítico con experiencia en tratamiento de aguas residuales…"
              ></textarea>
            </div>
            <div class="field">
              <label>Proceso / Área</label>
              <input type="text" [value]="v.area" (input)="setCampo('area', $event)" />
            </div>
            <div class="field">
              <label>Salario básico</label>
              <input type="text" inputmode="numeric" [value]="v.salario" (input)="setSalario($event)" placeholder="Ej: 3.377.598" />
            </div>
            <div class="field">
              <label>Tipo de vinculación</label>
              <select [ngModel]="v.tipoVinculacion" (ngModelChange)="set({ tipoVinculacion: $event })">
                <option value="">Seleccione…</option>
                @for (t of tiposVinculacion; track t) {
                  <option [value]="t">{{ t }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>Sede</label>
              <input type="text" [value]="v.sede" (input)="setCampo('sede', $event)" />
            </div>
            <div class="field">
              <label>N° de plazas</label>
              <input type="number" min="1" [value]="v.plazas" (input)="setCampo('plazas', $event)" />
            </div>
            <div class="field">
              <label>Público objetivo</label>
              <select [ngModel]="v.publicoObjetivo" (ngModelChange)="set({ publicoObjetivo: $event })">
                @for (p of publicoObjetivo; track p) {
                  <option [value]="p">{{ p }}</option>
                }
              </select>
            </div>
            <div class="field field--span2">
              <label>Estado</label>
              <select [ngModel]="v.estado" (ngModelChange)="set({ estado: $event })">
                @for (e of estados; track e.valor) {
                  <option [value]="e.valor">{{ e.etiqueta }}</option>
                }
              </select>
              <span class="hint">Solo "Publicada" y "Cerrada" son visibles para los candidatos.</span>
            </div>
            <div class="field">
              <label>Fecha de apertura</label>
              <input type="date" [value]="v.fechaApertura" (input)="setCampo('fechaApertura', $event)" />
            </div>
            <div class="field">
              <label>Fecha de cierre</label>
              <input type="date" [value]="v.fechaCierre" (input)="setCampo('fechaCierre', $event)" />
            </div>
            <div class="field">
              <label>Hora de cierre</label>
              <input type="time" [value]="v.horaCierre" (input)="setCampo('horaCierre', $event)" />
            </div>
          </div>
          <div class="field mt-24">
            <label>Requisitos obligatorios (texto libre, opcional)</label>
            <textarea [value]="v.requisitosObligatorios" (input)="setCampo('requisitosObligatorios', $event)"></textarea>
          </div>
          <div class="field">
            <label>Conocimientos complementarios</label>
            <textarea [value]="v.conocimientosComplementarios" (input)="setCampo('conocimientosComplementarios', $event)"></textarea>
          </div>
        </fieldset>

        <fieldset style="border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px">
          <legend style="font-weight: 700; color: var(--color-primary-dark); padding: 0 6px">Criterios de evaluación automática</legend>
          <p class="text-muted" style="font-size: 12.5px; margin-top: -4px">
            Estos criterios solo priorizan y advierten a Gestión Humana; nunca bloquean el envío de la solicitud del aspirante.
            Todos se evalúan como <strong>mínimos</strong>: un aspirante con un nivel superior al pedido también cumple.
          </p>
          <div class="field-grid">
            <div class="field">
              <label>Nivel educativo mínimo</label>
              <select [ngModel]="v.criterios.nivelEducativoMin" (ngModelChange)="setCriterio({ nivelEducativoMin: $event })">
                <option value="">Sin requisito</option>
                @for (n of nivelesEducativos; track n) {
                  <option [value]="n">{{ n }}</option>
                }
              </select>
              <span class="hint">Los niveles superiores también cumplen (ej. "Técnico" lo cumple un Universitario).</span>
            </div>
            <div class="field">
              <label>¿Requiere graduado?</label>
              <select [ngModel]="v.criterios.graduadoRequerido ? 'Sí' : 'No'" (ngModelChange)="setCriterio({ graduadoRequerido: $event === 'Sí' })">
                <option>Sí</option>
                <option>No</option>
              </select>
            </div>
            <div class="field">
              <label>Palabra clave de profesión/título</label>
              <input type="text" [value]="v.criterios.profesionKeyword" (input)="setCriterioCampo('profesionKeyword', $event)" />
            </div>
          </div>
          <div class="field-grid">
            <div class="field">
              <label>Años mínimos de experiencia</label>
              <input
                type="number"
                min="0"
                step="0.5"
                [value]="v.criterios.experienciaMinAnios"
                (input)="setCriterioCampo('experienciaMinAnios', $event)"
              />
            </div>
          </div>
          <div class="field-grid">
            <div class="field">
              <label>Idioma requerido (opcional)</label>
              <app-select-con-otro [value]="v.criterios.idiomaRequerido" [opciones]="idiomas" (changed)="setCriterio({ idiomaRequerido: $event })" />
            </div>
            <div class="field">
              <label>Nivel mínimo de dominio</label>
              <select [ngModel]="v.criterios.idiomaNivelMin" (ngModelChange)="setCriterio({ idiomaNivelMin: $event })">
                @for (n of nivelesIdioma; track n) {
                  <option [value]="n">{{ etiquetaNivelIdioma(n) }}</option>
                }
              </select>
              <span class="hint">Se evalúa un único nivel de dominio (MCER); los niveles superiores también cumplen.</span>
            </div>
          </div>

          <div class="field">
            <label>Certificaciones requeridas (palabra clave) hasta {{ maxCertificaciones }}, opcional</label>
            @if (certificaciones().length === 0) {
              <p class="text-muted" style="font-size: 12.5px; margin: 4px 0">Ninguna certificación requerida todavía.</p>
            }
            @for (c of certificaciones(); track $index; let i = $index) {
              <div style="display: flex; gap: 8px; margin-bottom: 8px">
                <input type="text" [attr.aria-label]="'Certificación ' + (i + 1)" [value]="c" (input)="cambiarCertificacion(i, $any($event.target).value)" placeholder="Ej: Trabajo en alturas" style="flex: 1" />
                <button type="button" class="hr-link-btn hr-link-btn--danger" (click)="quitarCertificacion(i)">Quitar</button>
              </div>
            }
            @if (certificaciones().length < maxCertificaciones) {
              <button type="button" class="btn btn-secondary" (click)="agregarCertificacion()">+ Agregar certificación</button>
            }
          </div>
        </fieldset>

        <fieldset style="border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px">
          <legend style="font-weight: 700; color: var(--color-primary-dark); padding: 0 6px">Formato oficial de la convocatoria (PDF)</legend>
          <p class="text-muted" style="font-size: 12.5px; margin-top: -4px">Opcional. Si lo subes, el candidato podra verlo.</p>
          @if (v.tieneDocumentoPdf && !pdfFile()) {
            <p style="font-size: 13px">📄 Ya hay un PDF para esta vacante. Elige otro archivo abajo si quieres reemplazarlo.</p>
          }
          <input type="file" accept="application/pdf" (change)="pdfFile.set($any($event.target).files?.[0] || null)" />
          @if (pdfFile(); as f) {
            <p style="font-size: 12.5px">Se subirá: {{ f.name }} ({{ (f.size / 1024 / 1024).toFixed(2) }} MB)</p>
          }
        </fieldset>

        <div class="btn-row" style="display: flex; gap: 10px">
          <button type="button" class="btn btn-primary" (click)="handleGuardar()" [disabled]="guardando()">
            {{ guardando() ? 'Guardando…' : 'Guardar vacante' }}
          </button>
          <button type="button" class="btn btn-secondary" (click)="onCancelar()()" [disabled]="guardando()">Cancelar</button>
        </div>
      </div>
    }
  `,
})
export class VacanteForm implements OnInit {
  readonly vacanteInicial = input.required<any>();
  /** Recibe la vacante limpia y el PDF (o null); el padre espera a que termine de guardar. */
  readonly onGuardar = input.required<(v: any, pdfFile: File | null) => Promise<void>>();
  readonly onCancelar = input.required<() => void>();

  protected readonly estados = ESTADOS;
  protected readonly tiposVinculacion = TIPOS_VINCULACION;
  protected readonly publicoObjetivo = PUBLICO_OBJETIVO_OPCIONES;
  protected readonly nivelesEducativos = NIVELES_EDUCATIVOS;
  protected readonly nivelesIdioma = NIVELES_IDIOMA;
  protected readonly idiomas = IDIOMAS;
  protected readonly etiquetaNivelIdioma = etiquetaNivelIdioma;
  protected readonly maxCertificaciones = MAX_CERTIFICACIONES;

  protected readonly v = signal<any>(null);
  protected readonly pdfFile = signal<File | null>(null);
  protected readonly guardando = signal(false);

  ngOnInit(): void {
    // Una vacante creada antes del cambio de escala trae criterios con la escala
    // anterior; se normalizan al abrir el formulario para que los selectores
    // muestren un valor válido en vez de quedar en blanco.
    this.v.set(normalizarVacanteParaFormulario(this.vacanteInicial()));
  }

  protected set(patch: any): void {
    this.v.update((prev) => ({ ...prev, ...patch }));
  }

  protected setCampo(key: string, e: Event): void {
    this.set({ [key]: (e.target as HTMLInputElement).value });
  }

  protected setSalario(e: Event): void {
    const el = e.target as HTMLInputElement;
    const formateado = formatearMilesCOP(el.value);
    el.value = formateado;
    this.set({ salario: formateado });
  }

  protected setCriterio(patch: any): void {
    this.v.update((prev) => ({ ...prev, criterios: { ...prev.criterios, ...patch } }));
  }

  protected setCriterioCampo(key: string, e: Event): void {
    this.setCriterio({ [key]: (e.target as HTMLInputElement).value });
  }

  protected certificaciones(): string[] {
    return this.v().criterios.certificacionesKeywords || [];
  }

  protected agregarCertificacion(): void {
    const certificaciones = this.certificaciones();
    if (certificaciones.length >= MAX_CERTIFICACIONES) return;
    this.setCriterio({ certificacionesKeywords: [...certificaciones, ''] });
  }

  protected cambiarCertificacion(i: number, valor: string): void {
    const copia = [...this.certificaciones()];
    copia[i] = valor;
    this.setCriterio({ certificacionesKeywords: copia });
  }

  protected quitarCertificacion(i: number): void {
    this.setCriterio({ certificacionesKeywords: this.certificaciones().filter((_, idx) => idx !== i) });
  }

  protected async handleGuardar(): Promise<void> {
    const v = this.v();
    if (!v.cargo.trim() || !v.procesoNo.trim()) {
      alert('Completa al menos el cargo y el número de proceso.');
      return;
    }
    const limpio = {
      ...v,
      plazas: v.plazas === '' ? 1 : Number(v.plazas),
      fechaApertura: v.fechaApertura || null,
      fechaCierre: v.fechaCierre || null,
      criterios: {
        ...v.criterios,
        experienciaMinAnios: v.criterios.experienciaMinAnios === '' ? null : Number(v.criterios.experienciaMinAnios),
        certificacionesKeywords: this.certificaciones()
          .map((c) => c.trim())
          .filter(Boolean),
      },
    };
    this.guardando.set(true);
    try {
      await this.onGuardar()(limpio, this.pdfFile());
    } finally {
      this.guardando.set(false);
    }
  }
}
