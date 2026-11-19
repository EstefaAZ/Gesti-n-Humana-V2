import { Component, OnInit, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NIVELES_EDUCATIVOS, NIVELES_IDIOMA, IDIOMAS, TIPOS_VINCULACION, PUBLICO_OBJETIVO_OPCIONES, etiquetaNivelIdioma } from '../../data/catalogos';
import { formatearFecha, formatearMilesCOP } from '../../lib/formato';
import { FolioNav, DefinicionPaso } from '../../components/folio-nav';
import { Field } from '../../components/field';
import { normalizarVacanteParaFormulario } from '../../lib/vacanteDefaults';
import { SelectConOtro } from '../../components/select-con-otro';
import { Icon } from '../../shared/icon';
import { ZonaArchivos, pesoLegible } from '../../components/zona-archivos';

const ESTADOS = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'publicada', etiqueta: 'Abierta' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'cerrada', etiqueta: 'Cerrada' },
  { valor: 'cancelada_desierta', etiqueta: 'Cancelada / Desierta' },
];

const MAX_CERTIFICACIONES = 5;

// Mismo formulario por pasos que "Completar perfil": un paso por grupo de información.
const PASOS = ['CONV', 'FECHAS', 'REQ', 'CRIT', 'PDF', 'REV'];
const DEFINICIONES_PASOS: Record<string, DefinicionPaso> = {
  CONV: { nombre: 'Convocatoria', icono: 'briefcase' },
  FECHAS: { nombre: 'Fechas y estado', icono: 'calendario' },
  REQ: { nombre: 'Requisitos', icono: 'birrete' },
  CRIT: { nombre: 'Criterios', icono: 'balanza' },
  PDF: { nombre: 'Formato PDF', icono: 'documento' },
  REV: { nombre: 'Revisión', icono: 'check' },
};

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  selector: 'app-vacante-form',
  imports: [CampoAccesible, FormsModule, SelectConOtro, Icon, ZonaArchivos, FolioNav, Field],
  host: { style: 'display: contents' },
  template: `
    @if (v(); as v) {
      <div class="card formulario-app">
        <div class="ps-wizard__cabecera">
          <div>
            <h2 class="ps-wizard__titulo">{{ editando() ? 'Editar vacante' : 'Nueva vacante' }}</h2>
            @if (editando()) {
              <p class="ps-wizard__sub">{{ vacanteInicial().procesoNo }} · {{ vacanteInicial().cargo }}</p>
            }
          </div>
          <button type="button" class="btn btn-secondary btn-sm" (click)="onCancelar()()" [disabled]="guardando()">Cancelar</button>
        </div>

        <div class="notice notice--info">
          @if (editando()) {
            Revisa los pasos que necesites y guarda cuando termines; puedes guardar los cambios desde cualquier paso.
          } @else {
            Completa la convocatoria paso a paso. Puedes volver atrás sin perder lo que ya escribiste; nada se guarda
            hasta que pulses <strong>Guardar vacante</strong> en el último paso.
          }
        </div>

        <app-folio-nav [steps]="pasos" [definiciones]="definicionesPasos" [activeStep]="pasoActual()" [doneSteps]="pasosHechos()" />

        @switch (pasoActual()) {
          @case ('CONV') {
            <section>
              <h3 class="section-title">Datos de la convocatoria</h3>
              <p class="section-intro">Lo que verá el candidato en el listado y en el detalle de la vacante.</p>
              <div class="field-grid">
                <app-field label="Proceso de selección No. *" [error]="errors().procesoNo">
                  <input type="text" [value]="v.procesoNo" (input)="setCampo('procesoNo', $event)" placeholder="Ej: 2026-P02-06" />
                </app-field>
                <app-field label="N° de plazas">
                  <input type="number" min="1" [value]="v.plazas" (input)="setCampo('plazas', $event)" />
                </app-field>
                <app-field label="Cargo *" span2 [error]="errors().cargo">
                  <input type="text" [value]="v.cargo" (input)="setCampo('cargo', $event)" />
                </app-field>
                <app-field label="Descripción breve" span2 hint="Un par de frases sobre el cargo; aparece en el listado de vacantes.">
                  <textarea
                    [value]="v.descripcion"
                    (input)="setCampo('descripcion', $event)"
                    placeholder="Ej: Buscamos un perfil analítico con experiencia en tratamiento de aguas residuales…"
                  ></textarea>
                </app-field>
                <app-field label="Proceso / Área">
                  <input type="text" [value]="v.area" (input)="setCampo('area', $event)" />
                </app-field>
                <app-field label="Sede">
                  <input type="text" [value]="v.sede" (input)="setCampo('sede', $event)" />
                </app-field>
                <app-field label="Tipo de vinculación">
                  <select [ngModel]="v.tipoVinculacion" (ngModelChange)="set({ tipoVinculacion: $event })">
                    <option value="">Seleccione…</option>
                    @for (t of tiposVinculacion; track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                </app-field>
                <app-field label="Salario básico">
                  <input type="text" inputmode="numeric" [value]="v.salario" (input)="setSalario($event)" placeholder="Ej: 3.377.598" />
                </app-field>
                <app-field label="Público objetivo">
                  <select [ngModel]="v.publicoObjetivo" (ngModelChange)="set({ publicoObjetivo: $event })">
                    @for (p of publicoObjetivo; track p) {
                      <option [value]="p">{{ p }}</option>
                    }
                  </select>
                </app-field>
              </div>
            </section>
          }

          @case ('FECHAS') {
            <section>
              <h3 class="section-title">Fechas y estado</h3>
              <p class="section-intro">Después de la fecha y hora de cierre ya no se reciben inscripciones.</p>
              <div class="field-grid">
                <app-field label="Estado de la vacante" span2 hint='Solo las vacantes "Abierta" y vigentes aparecen en el listado de candidatos; al cerrarse o cancelarse, solo las ven quienes se postularon.'>
                  <select [ngModel]="v.estado" (ngModelChange)="set({ estado: $event })">
                    @for (e of estados; track e.valor) {
                      <option [value]="e.valor">{{ e.etiqueta }}</option>
                    }
                  </select>
                </app-field>
              </div>
              <div class="field-grid field-grid--3" style="margin-top: 16px">
                <app-field label="Fecha de apertura">
                  <input type="date" [value]="v.fechaApertura" (input)="setCampo('fechaApertura', $event)" />
                </app-field>
                <app-field label="Fecha de cierre" [error]="errors().fechaCierre">
                  <input type="date" [value]="v.fechaCierre" (input)="setCampo('fechaCierre', $event)" />
                </app-field>
                <app-field label="Hora de cierre">
                  <input type="time" [value]="v.horaCierre" (input)="setCampo('horaCierre', $event)" />
                </app-field>
              </div>
            </section>
          }

          @case ('REQ') {
            <section>
              <h3 class="section-title">Requisitos del cargo</h3>
              <p class="section-intro">Texto libre que se le muestra al candidato. Ambos campos son opcionales.</p>
              <div class="field-grid">
                <app-field label="Requisitos obligatorios" span2 hint="Estudios, experiencia o condiciones que el aspirante debe cumplir.">
                  <textarea [value]="v.requisitosObligatorios" (input)="setCampo('requisitosObligatorios', $event)"></textarea>
                </app-field>
                <app-field label="Conocimientos complementarios" span2 hint="Herramientas, normas o conocimientos que suman puntos.">
                  <textarea [value]="v.conocimientosComplementarios" (input)="setCampo('conocimientosComplementarios', $event)"></textarea>
                </app-field>
              </div>
            </section>
          }

          @case ('CRIT') {
            <section>
              <h3 class="section-title">Criterios de evaluación automática</h3>
              <p class="section-intro">
                Solo priorizan y advierten a Gestión Humana; nunca bloquean la solicitud del aspirante. Todos son
                <strong>mínimos</strong>: un nivel superior al pedido también cumple. Estudios y experiencia son obligatorios;
                los conocimientos complementarios (profesión, idioma y certificaciones) son opcionales.
              </p>
              <div class="field-grid">
                <app-field label="Nivel educativo mínimo *" hint='Ej. "Técnico" también lo cumple un Universitario.' [error]="errors().nivelEducativoMin">
                  <select [ngModel]="v.criterios.nivelEducativoMin" (ngModelChange)="setCriterio({ nivelEducativoMin: $event })">
                    <option value="" disabled>Selecciona un nivel</option>
                    @for (n of nivelesEducativos; track n) {
                      <option [value]="n">{{ n }}</option>
                    }
                  </select>
                </app-field>
                <app-field label="¿Requiere graduado?">
                  <select [ngModel]="v.criterios.graduadoRequerido ? 'Sí' : 'No'" (ngModelChange)="setCriterio({ graduadoRequerido: $event === 'Sí' })">
                    <option>Sí</option>
                    <option>No</option>
                  </select>
                </app-field>
                <app-field label="Palabra clave de profesión o título">
                  <input type="text" [value]="v.criterios.profesionKeyword" (input)="setCriterioCampo('profesionKeyword', $event)" placeholder="Ej: Ingeniería civil" />
                </app-field>
                <app-field label="Años mínimos de experiencia *" hint="Usa 0 si el cargo no exige experiencia (p. ej. practicantes)." [error]="errors().experienciaMinAnios">
                  <input type="number" min="0" step="0.5" [value]="v.criterios.experienciaMinAnios" (input)="setCriterioCampo('experienciaMinAnios', $event)" />
                </app-field>
                <app-field label="Idioma requerido">
                  <app-select-con-otro [value]="v.criterios.idiomaRequerido" [opciones]="idiomas" (changed)="setCriterio({ idiomaRequerido: $event })" />
                </app-field>
                <app-field label="Nivel mínimo de dominio" hint="Escala MCER; los niveles superiores también cumplen.">
                  <select [ngModel]="v.criterios.idiomaNivelMin" (ngModelChange)="setCriterio({ idiomaNivelMin: $event })">
                    @for (n of nivelesIdioma; track n) {
                      <option [value]="n">{{ etiquetaNivelIdioma(n) }}</option>
                    }
                  </select>
                </app-field>
              </div>

              <div class="field" style="margin-top: 20px">
                <label>Certificaciones requeridas <span class="hint">(palabra clave, hasta {{ maxCertificaciones }})</span></label>
                <div class="ps-certificaciones">
                  @for (c of certificaciones(); track $index; let i = $index) {
                    <div class="ps-certificacion">
                      <input type="text" [attr.aria-label]="'Certificación ' + (i + 1)" [value]="c" (input)="cambiarCertificacion(i, $any($event.target).value)" placeholder="Ej: Trabajo en alturas" />
                      <button type="button" class="hr-link-btn hr-link-btn--danger" [attr.aria-label]="'Quitar certificación ' + (i + 1)" (click)="quitarCertificacion(i)">Quitar</button>
                    </div>
                  }
                  @if (certificaciones().length < maxCertificaciones) {
                    <button type="button" class="btn btn-secondary btn-sm" (click)="agregarCertificacion()">
                      <app-icon name="mas" [size]="14" [strokeWidth]="2.2" /> Agregar certificación
                    </button>
                  }
                </div>
              </div>
            </section>
          }

          @case ('PDF') {
            <section>
              <h3 class="section-title">Formato oficial de la convocatoria</h3>
              <p class="section-intro">Opcional. Si subes el PDF (GTH-FOR-02), el candidato podrá verlo desde el detalle de la vacante.</p>
              @if (pdfFile(); as f) {
                <ul class="archivos-lista">
                  <li class="archivo-item">
                    <span class="archivo-item__icono" aria-hidden="true"><app-icon name="documento" [size]="16" [strokeWidth]="1.8" /></span>
                    <span class="archivo-item__texto">
                      <span class="archivo-item__nombre" [title]="f.name">{{ f.name }}</span>
                      <span class="archivo-item__detalle">{{ pesoArchivo(f.size) }} · se subirá al guardar</span>
                    </span>
                    <button type="button" class="hr-link-btn hr-link-btn--danger" [attr.aria-label]="'Quitar ' + f.name" (click)="pdfFile.set(null)">Quitar</button>
                  </li>
                </ul>
              } @else {
                @if (v.tieneDocumentoPdf) {
                  <ul class="archivos-lista">
                    <li class="archivo-item">
                      <span class="archivo-item__icono" aria-hidden="true"><app-icon name="documento" [size]="16" [strokeWidth]="1.8" /></span>
                      <span class="archivo-item__texto">
                        <span class="archivo-item__nombre">PDF actual de la convocatoria</span>
                        <span class="archivo-item__detalle">Elige otro abajo si quieres reemplazarlo</span>
                      </span>
                    </li>
                  </ul>
                }
                <app-zona-archivos
                  accept="application/pdf,.pdf"
                  textoTipos="solo se acepta un PDF"
                  [textoBoton]="v.tieneDocumentoPdf ? 'Reemplazar PDF' : 'Elegir PDF'"
                  etiqueta="Formato oficial de la convocatoria"
                  (archivos)="pdfFile.set($event[0])"
                />
              }
            </section>
          }

          @case ('REV') {
            <section>
              <h3 class="section-title">Revisa y guarda</h3>
              <p class="section-intro">Confirma que todo esté bien. Si necesitas corregir algo, pulsa <strong>Editar</strong> en esa parte.</p>

              <div class="ps-revision">
                <div class="ps-revision__bloque">
                  <div class="ps-revision__cabecera">
                    <h4>Datos de la convocatoria</h4>
                    <button type="button" class="hr-link-btn" (click)="irA('CONV')">Editar</button>
                  </div>
                  <dl class="ps-revision__datos">
                    <div class="ps-revision__dato ps-revision__dato--ancho"><dt>Cargo</dt><dd>{{ v.cargo || '—' }}</dd></div>
                    <div class="ps-revision__dato"><dt>Proceso No.</dt><dd>{{ v.procesoNo || '—' }}</dd></div>
                    <div class="ps-revision__dato"><dt>Plazas</dt><dd>{{ v.plazas || 1 }}</dd></div>
                    <div class="ps-revision__dato"><dt>Área</dt><dd>{{ v.area || '—' }}</dd></div>
                    <div class="ps-revision__dato"><dt>Sede</dt><dd>{{ v.sede || '—' }}</dd></div>
                    <div class="ps-revision__dato"><dt>Vinculación</dt><dd>{{ v.tipoVinculacion || '—' }}</dd></div>
                    <div class="ps-revision__dato"><dt>Salario</dt><dd>{{ v.salario ? '$ ' + v.salario : '—' }}</dd></div>
                    <div class="ps-revision__dato"><dt>Público objetivo</dt><dd>{{ v.publicoObjetivo || '—' }}</dd></div>
                  </dl>
                </div>

                <div class="ps-revision__bloque">
                  <div class="ps-revision__cabecera">
                    <h4>Fechas y estado</h4>
                    <button type="button" class="hr-link-btn" (click)="irA('FECHAS')">Editar</button>
                  </div>
                  <dl class="ps-revision__datos">
                    <div class="ps-revision__dato"><dt>Estado</dt><dd>{{ etiquetaEstado(v.estado) }}</dd></div>
                    <div class="ps-revision__dato"><dt>Apertura</dt><dd>{{ fecha(v.fechaApertura) || '—' }}</dd></div>
                    <div class="ps-revision__dato"><dt>Cierre</dt><dd>{{ v.fechaCierre ? fecha(v.fechaCierre) + (v.horaCierre ? ' · ' + v.horaCierre : '') : '—' }}</dd></div>
                  </dl>
                </div>

                <div class="ps-revision__bloque">
                  <div class="ps-revision__cabecera">
                    <h4>Criterios de evaluación</h4>
                    <button type="button" class="hr-link-btn" (click)="irA('CRIT')">Editar</button>
                  </div>
                  @if (resumenCriterios().length > 0) {
                    <ul class="ps-etiquetas">
                      @for (c of resumenCriterios(); track $index) {
                        <li class="ps-etiqueta">{{ c.nombre }}: <strong>{{ c.valor }}</strong></li>
                      }
                    </ul>
                  } @else {
                    <p class="ps-sin-criterios">Sin criterios automáticos: todas las postulaciones se revisarán manualmente.</p>
                  }
                </div>

                <div class="ps-revision__bloque">
                  <div class="ps-revision__cabecera">
                    <h4>Requisitos y formato PDF</h4>
                    <button type="button" class="hr-link-btn" (click)="irA('REQ')">Editar</button>
                  </div>
                  <dl class="ps-revision__datos">
                    <div class="ps-revision__dato"><dt>Requisitos obligatorios</dt><dd>{{ v.requisitosObligatorios?.trim() ? 'Escritos' : 'Sin texto' }}</dd></div>
                    <div class="ps-revision__dato"><dt>Conocimientos complementarios</dt><dd>{{ v.conocimientosComplementarios?.trim() ? 'Escritos' : 'Sin texto' }}</dd></div>
                    <div class="ps-revision__dato"><dt>PDF de la convocatoria</dt><dd>{{ pdfFile() ? pdfFile()!.name + ' (nuevo)' : v.tieneDocumentoPdf ? 'Adjunto' : 'Sin PDF' }}</dd></div>
                  </dl>
                </div>
              </div>
            </section>
          }
        }

        <div class="wizard-actions">
          <button type="button" class="btn btn-secondary" (click)="onAtras()" [style.visibility]="indice() === 0 ? 'hidden' : 'visible'" [disabled]="guardando()">
            Atrás
          </button>
          <div class="ps-wizard__derecha">
            @if (editando() && !esUltimo()) {
              <button type="button" class="btn btn-secondary" (click)="handleGuardar()" [disabled]="guardando()">
                {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
              </button>
            }
            <button type="button" class="btn btn-primary" (click)="onSiguiente()" [disabled]="guardando()">
              {{ esUltimo() ? (guardando() ? 'Guardando…' : editando() ? 'Guardar cambios' : 'Guardar vacante') : 'Siguiente' }}
            </button>
          </div>
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
  protected readonly pesoArchivo = pesoLegible;
  protected readonly guardando = signal(false);

  protected readonly pasos = PASOS;
  protected readonly definicionesPasos = DEFINICIONES_PASOS;
  protected readonly indice = signal(0);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly fecha = formatearFecha;

  protected pasoActual(): string {
    return PASOS[this.indice()];
  }

  protected pasosHechos(): string[] {
    return PASOS.slice(0, this.indice());
  }

  protected esUltimo(): boolean {
    return this.indice() === PASOS.length - 1;
  }

  protected editando(): boolean {
    return !!(this.vacanteInicial().id && this.vacanteInicial()._editando);
  }

  protected etiquetaEstado(valor: string): string {
    return ESTADOS.find((e) => e.valor === valor)?.etiqueta || valor || '—';
  }

  /** Errores del paso indicado (vacío si está bien). */
  private erroresDe(paso: string): Record<string, string> {
    const v = this.v();
    const errores: Record<string, string> = {};
    if (paso === 'CONV') {
      if (!String(v.procesoNo || '').trim()) errores['procesoNo'] = 'Este campo es obligatorio.';
      if (!String(v.cargo || '').trim()) errores['cargo'] = 'Este campo es obligatorio.';
    }
    if (paso === 'CRIT') {
      if (!v.criterios.nivelEducativoMin) errores['nivelEducativoMin'] = 'Indica el nivel educativo mínimo.';
      const anios = v.criterios.experienciaMinAnios;
      if (anios === '' || anios == null || Number.isNaN(Number(anios))) {
        errores['experienciaMinAnios'] = 'Indica los años mínimos de experiencia (0 si no se exige).';
      } else if (Number(anios) < 0) {
        errores['experienciaMinAnios'] = 'Los años no pueden ser negativos.';
      }
    }
    if (paso === 'FECHAS' && v.fechaApertura && v.fechaCierre && v.fechaCierre < v.fechaApertura) {
      errores['fechaCierre'] = 'La fecha de cierre no puede ser anterior a la de apertura.';
    }
    return errores;
  }

  private irArriba(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected onSiguiente(): void {
    const errores = this.erroresDe(this.pasoActual());
    this.errors.set(errores);
    if (Object.keys(errores).length > 0) return;
    if (this.esUltimo()) {
      this.handleGuardar();
      return;
    }
    this.indice.update((i) => i + 1);
    this.irArriba();
  }

  protected onAtras(): void {
    this.errors.set({});
    this.indice.update((i) => Math.max(0, i - 1));
    this.irArriba();
  }

  protected irA(paso: string): void {
    this.errors.set({});
    this.indice.set(PASOS.indexOf(paso));
    this.irArriba();
  }

  protected resumenCriterios(): { nombre: string; valor: string }[] {
    const c = this.v().criterios || {};
    const lista: { nombre: string; valor: string }[] = [];
    if (c.nivelEducativoMin) lista.push({ nombre: 'Estudios', valor: `${c.nivelEducativoMin} o superior${c.graduadoRequerido ? ', graduado' : ''}` });
    if (String(c.profesionKeyword || '').trim()) lista.push({ nombre: 'Profesión', valor: c.profesionKeyword.trim() });
    if (c.experienciaMinAnios !== '' && c.experienciaMinAnios != null && Number(c.experienciaMinAnios) === 0) {
      lista.push({ nombre: 'Experiencia', valor: 'No exige experiencia previa' });
    } else if (c.experienciaMinAnios !== '' && c.experienciaMinAnios != null && Number(c.experienciaMinAnios) > 0) {
      lista.push({ nombre: 'Experiencia', valor: `${c.experienciaMinAnios} ${Number(c.experienciaMinAnios) === 1 ? 'año' : 'años'} mínimo` });
    }
    if (c.idiomaRequerido) lista.push({ nombre: c.idiomaRequerido, valor: `${etiquetaNivelIdioma(c.idiomaNivelMin)} o superior` });
    for (const cert of this.certificaciones().map((x) => x.trim()).filter(Boolean)) lista.push({ nombre: 'Certificación', valor: cert });
    return lista;
  }

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
    // Desde cualquier paso (al editar) se valida lo obligatorio y se lleva al paso con el error.
    for (const paso of PASOS) {
      const errores = this.erroresDe(paso);
      if (Object.keys(errores).length > 0) {
        this.indice.set(PASOS.indexOf(paso));
        this.errors.set(errores);
        this.irArriba();
        return;
      }
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
