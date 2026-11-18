import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TIPO_REGISTRO_LABELS,
  NIVELES_IDIOMA,
  IDIOMAS,
  CAMPOS_IDIOMA_ANTERIORES,
  etiquetaNivelIdioma,
  nivelDeRegistroIdioma,
} from '../../data/catalogos';
import { MUNICIPIOS_POR_DEPARTAMENTO, DEPARTAMENTOS } from '../../data/municipiosPorDepartamento';
import { SelectConOtro } from '../select-con-otro';
import { Icon } from '../../shared/icon';
import { anio, unir } from './lista-plegable';

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  selector: 'app-registro-ii-card',
  imports: [CampoAccesible, FormsModule, SelectConOtro, Icon],
  host: { style: 'display: contents' },
  template: `
    <div class="reg" [class.is-abierto]="abierto()" [id]="'reg-' + registro().id">
      <div class="reg__cab">
        <span class="reg__icono" aria-hidden="true"><app-icon name="birrete" [size]="18" [strokeWidth]="1.8" /></span>
        <button
          type="button"
          class="reg__resumen"
          [attr.aria-expanded]="abierto()"
          [attr.aria-controls]="abierto() ? 'reg-cuerpo-' + registro().id : null"
          (click)="alternar.emit()"
        >
          <span class="reg__textos">
            <span class="reg__titulo">{{ resumen().titulo }}</span>
            <span class="reg__detalle">{{ resumen().detalle }}</span>
          </span>
          <span class="reg__chev" aria-hidden="true"><app-icon name="chevronAbajo" [size]="18" [strokeWidth]="2" /></span>
        </button>
        <button
          type="button"
          class="reg__quitar"
          title="Eliminar"
          [attr.aria-label]="'Eliminar ' + resumen().titulo"
          (click)="quitar.emit(registro().id)"
        >
          <app-icon name="papelera" [size]="17" [strokeWidth]="1.8" />
        </button>
      </div>

      @if (abierto()) {
      <div class="reg__cuerpo" [id]="'reg-cuerpo-' + registro().id">

      <div class="field" style="margin-bottom: 16px">
        <label>Tipo de registro</label>
        <select [ngModel]="registro().tipo" (ngModelChange)="setTipo($event)">
          <option value="estudio">Estudio formal</option>
          <option value="educacionTrabajo">Educación para el trabajo y el desarrollo humano</option>
          <option value="certificacion">Certificaciones y matrículas</option>
          <option value="idioma">Idioma</option>
        </select>
      </div>

      @if (registro().tipo === 'estudio') {
        <div class="field-grid">
          <div class="field">
            <label>Nivel educativo</label>
            <select [ngModel]="registro().nivelEducativo || ''" (ngModelChange)="set({ nivelEducativo: $event })">
              <option value="">Seleccione…</option>
              <option>Secundarios</option>
              <option>Técnico</option>
              <option>Tecnólogo</option>
              <option>Universitario</option>
              <option>Postgrado</option>
            </select>
          </div>
          <div class="field">
            <label>¿Graduado?</label>
            <div class="radio-row">
              <label class="radio-option">
                <input type="radio" [name]="'graduado-' + registro().id" [checked]="registro().graduado === 'si'" (change)="set({ graduado: 'si' })" /> Sí
              </label>
              <label class="radio-option">
                <input type="radio" [name]="'graduado-' + registro().id" [checked]="registro().graduado === 'no'" (change)="set({ graduado: 'no' })" /> No
              </label>
            </div>
          </div>
          <div class="field field--span2">
            <label>Título</label>
            <input type="text" [value]="registro().titulo || ''" (input)="setCampo('titulo', $event)" />
          </div>
          <div class="field">
            <label>Establecimiento</label>
            <input type="text" [value]="registro().establecimiento || ''" (input)="setCampo('establecimiento', $event)" />
          </div>
          <div class="field">
            <label>Departamento</label>
            <app-select-con-otro
              [value]="registro().departamento || ''"
              [opciones]="departamentos"
              (changed)="set({ departamento: $event, ciudad: '' })"
            />
          </div>
          <div class="field">
            <label>Ciudad</label>
            <app-select-con-otro
              [clave]="registro().departamento"
              [value]="registro().ciudad || ''"
              [opciones]="municipios[registro().departamento] || sinOpciones"
              (changed)="set({ ciudad: $event })"
              [placeholder]="registro().departamento ? 'Seleccione…' : 'Elige primero el departamento'"
            />
          </div>
          <div class="field">
            <label>Inicio (Año - Mes)</label>
            <input type="month" [value]="registro().inicio || ''" (input)="setCampo('inicio', $event)" />
          </div>
          <div class="field">
            <label>Terminación (Año - Mes)</label>
            <input type="month" [value]="registro().terminacion || ''" (input)="setCampo('terminacion', $event)" />
          </div>
        </div>
      }

      @if (registro().tipo === 'educacionTrabajo') {
        <div class="field-grid">
          <div class="field field--span2">
            <label>Nombre del evento</label>
            <input type="text" [value]="registro().nombreEvento || ''" (input)="setCampo('nombreEvento', $event)" />
          </div>
          <div class="field">
            <label>Fecha del certificado (Año - Mes)</label>
            <input type="month" [value]="registro().fechaCertificado || ''" (input)="setCampo('fechaCertificado', $event)" />
          </div>
          <div class="field">
            <label>N° de horas</label>
            <input type="number" min="0" [value]="registro().numHoras || ''" (input)="setCampo('numHoras', $event)" />
          </div>
          <div class="field field--span2">
            <label>Establecimiento</label>
            <input type="text" [value]="registro().establecimiento || ''" (input)="setCampo('establecimiento', $event)" />
          </div>
        </div>
      }

      @if (registro().tipo === 'certificacion') {
        <div class="field-grid">
          <div class="field field--span2">
            <label>Nombre de la norma o del certificado</label>
            <input type="text" [value]="registro().nombreNorma || ''" (input)="setCampo('nombreNorma', $event)" />
          </div>
          <div class="field">
            <label>Número de documento o de la norma</label>
            <input type="text" [value]="registro().numDocumento || ''" (input)="setCampo('numDocumento', $event)" />
          </div>
          <div class="field">
            <label>Fecha del certificado (Año - Mes)</label>
            <input type="month" [value]="registro().fechaCertificado || ''" (input)="setCampo('fechaCertificado', $event)" />
          </div>
          <div class="field field--span2">
            <label>Ente certificador</label>
            <input type="text" [value]="registro().enteCertificador || ''" (input)="setCampo('enteCertificador', $event)" />
          </div>
        </div>
      }

      @if (registro().tipo === 'idioma') {
        <div class="field-grid field-grid--3">
          <div class="field">
            <label>Idioma</label>
            <app-select-con-otro [value]="registro().idioma || ''" [opciones]="idiomas" (changed)="set({ idioma: $event })" />
          </div>
          <div class="field">
            <label>Establecimiento</label>
            <input type="text" [value]="registro().establecimiento || ''" (input)="setCampo('establecimiento', $event)" />
          </div>
          <div class="field">
            <label>Fecha (Año - Mes)</label>
            <input type="month" [value]="registro().fecha || ''" (input)="setCampo('fecha', $event)" />
          </div>
          <div class="field">
            <label>Nivel de dominio</label>
            <select [ngModel]="nivelIdioma()" (ngModelChange)="setNivelIdioma($event)">
              <option value="">Seleccione…</option>
              @for (n of nivelesIdioma; track n) {
                <option [value]="n">{{ etiquetaNivelIdioma(n) }}</option>
              }
            </select>
            <span class="hint">Equivalencia con el Marco Común Europeo de Referencia (MCER).</span>
          </div>
        </div>
      }
        <div class="reg__acciones">
          <button type="button" class="btn btn-primary btn-sm" (click)="listo.emit()">Listo</button>
        </div>
      </div>
      }
    </div>
  `,
})
export class RegistroIICard {
  readonly registro = input.required<any>();
  readonly index = input<number>(0);
  readonly cambiar = output<{ id: string; patch: any }>();
  readonly quitar = output<string>();
  readonly abierto = input<boolean>(false);
  readonly alternar = output<void>();
  readonly listo = output<void>();

  /** Lo que se ve con la tarjeta cerrada: "Derecho" · "Universitario · Universidad de Medellín · 2011–2016". */
  protected readonly resumen = computed(() => {
    const r = this.registro();
    const tipo = TIPO_REGISTRO_LABELS[r.tipo] || 'Registro';
    const rango = (a: string, b: string) => unir([anio(a), anio(b)], '–');
    switch (r.tipo) {
      case 'estudio':
        return {
          titulo: r.titulo || 'Estudio sin título',
          detalle: unir([r.nivelEducativo, r.establecimiento, rango(r.inicio, r.terminacion), r.graduado === 'no' ? 'Sin graduarse' : '']) || 'Sin completar',
        };
      case 'educacionTrabajo':
        return {
          titulo: r.nombreEvento || 'Curso sin nombre',
          detalle: unir([tipo, r.establecimiento, r.numHoras ? `${r.numHoras} horas` : '', anio(r.fechaCertificado)]),
        };
      case 'certificacion':
        return { titulo: r.nombreNorma || 'Certificación sin nombre', detalle: unir([tipo, r.enteCertificador, anio(r.fechaCertificado)]) };
      case 'idioma': {
        const nivel = nivelDeRegistroIdioma(r);
        return {
          titulo: r.idioma || 'Idioma sin indicar',
          detalle: unir(['Idioma', nivel ? `Nivel ${etiquetaNivelIdioma(nivel)}` : '', r.establecimiento]),
        };
      }
      default:
        return { titulo: 'Registro sin completar', detalle: tipo };
    }
  });

  protected readonly departamentos = DEPARTAMENTOS;
  protected readonly municipios = MUNICIPIOS_POR_DEPARTAMENTO;
  protected readonly idiomas = IDIOMAS;
  protected readonly nivelesIdioma = NIVELES_IDIOMA;
  protected readonly etiquetaNivelIdioma = etiquetaNivelIdioma;
  protected readonly sinOpciones: string[] = [];

  protected set(patch: any): void {
    this.cambiar.emit({ id: this.registro().id, patch });
  }

  protected setCampo(key: string, e: Event): void {
    this.set({ [key]: (e.target as HTMLInputElement).value });
  }

  protected setTipo(tipo: string): void {
    this.set({ tipo, tipoLabel: TIPO_REGISTRO_LABELS[tipo] });
  }

  // Un registro guardado con la escala anterior se muestra ya convertido; al
  // tocarlo se guarda en la escala nueva y se descartan los campos viejos.
  protected nivelIdioma(): string {
    return nivelDeRegistroIdioma(this.registro());
  }

  protected setNivelIdioma(nivel: string): void {
    this.set({ nivel, ...Object.fromEntries(CAMPOS_IDIOMA_ANTERIORES.map((c) => [c, undefined])) });
  }
}
