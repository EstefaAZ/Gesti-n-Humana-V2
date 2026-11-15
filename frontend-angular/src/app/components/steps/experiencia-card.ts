import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { calcularTiempoLaborado } from '../../lib/formState';
import { MUNICIPIOS_POR_DEPARTAMENTO, DEPARTAMENTOS } from '../../data/municipiosPorDepartamento';
import { PAISES } from '../../data/paises';
import { SelectConOtro } from '../select-con-otro';

// La lista dependiente Departamento -> Ciudad solo existe para Colombia (es la
// única fuente oficial —DIVIPOLA— que tiene el sistema). Para cualquier otro
// país esos dos campos quedan como texto libre, igual que antes de este cambio.
function _esColombia(pais: string | undefined): boolean {
  return (pais || '').trim().toLowerCase() === 'colombia';
}

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  selector: 'app-experiencia-card',
  imports: [CampoAccesible, FormsModule, SelectConOtro],
  host: { style: 'display: contents' },
  template: `
    <div class="repeatable-block">
      <div class="repeatable-block__header">
        <span class="repeatable-block__title">Experiencia laboral {{ index() + 1 }}</span>
        <button type="button" class="repeatable-block__remove" (click)="quitar.emit(experiencia().id)">Eliminar</button>
      </div>

      <div class="field-grid">
        <div class="field field--span2">
          <label>Nombre de la empresa</label>
          <input type="text" [value]="experiencia().empresa || ''" (input)="setCampo('empresa', $event)" />
        </div>
        <div class="field">
          <label>País</label>
          <select [ngModel]="experiencia().pais || ''" (ngModelChange)="set({ pais: $event, departamento: '', ciudad: '' })">
            <option value="">Seleccione…</option>
            @for (p of paises; track p) {
              <option [value]="p">{{ p }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>{{ esColombia() ? 'Departamento' : 'Departamento/Estado/Provincia' }}</label>
          @if (esColombia()) {
            <app-select-con-otro
              [value]="experiencia().departamento || ''"
              [opciones]="departamentos"
              (changed)="set({ departamento: $event, ciudad: '' })"
            />
          } @else {
            <input
              type="text"
              [value]="experiencia().departamento || ''"
              (input)="setCampo('departamento', $event)"
              [disabled]="!experiencia().pais"
              [placeholder]="experiencia().pais ? '' : 'Elige primero el país'"
            />
          }
        </div>
        <div class="field">
          <label>Ciudad</label>
          @if (esColombia()) {
            <app-select-con-otro
              [clave]="experiencia().departamento"
              [value]="experiencia().ciudad || ''"
              [opciones]="municipios[experiencia().departamento] || sinOpciones"
              (changed)="set({ ciudad: $event })"
              [placeholder]="experiencia().departamento ? 'Seleccione…' : 'Elige primero el departamento'"
            />
          } @else {
            <input
              type="text"
              [value]="experiencia().ciudad || ''"
              (input)="setCampo('ciudad', $event)"
              [disabled]="!experiencia().pais"
              [placeholder]="experiencia().pais ? '' : 'Elige primero el país'"
            />
          }
        </div>
        <div class="field">
          <label>Tipo de empresa</label>
          <select [ngModel]="experiencia().tipoEmpresa || ''" (ngModelChange)="set({ tipoEmpresa: $event })">
            <option value="">Seleccione…</option>
            <option>Pública</option>
            <option>Privada</option>
            <option>Mixta</option>
          </select>
        </div>
        <div class="field">
          <label>Proceso en el cual laboró</label>
          <input type="text" [value]="experiencia().proceso || ''" (input)="setCampo('proceso', $event)" />
        </div>
        <div class="field">
          <label>Jefe inmediato</label>
          <input type="text" [value]="experiencia().jefeInmediato || ''" (input)="setCampo('jefeInmediato', $event)" />
        </div>
        <div class="field">
          <label>Teléfono de la empresa</label>
          <input type="tel" [value]="experiencia().telEmpresa || ''" (input)="setCampo('telEmpresa', $event)" />
        </div>
        <div class="field field--span2">
          <label>Cargo desempeñado</label>
          <input type="text" [value]="experiencia().cargo || ''" (input)="setCampo('cargo', $event)" />
        </div>
        <div class="field">
          <label>Fecha inicio</label>
          <input type="date" [value]="experiencia().fechaInicio || ''" (input)="setCampo('fechaInicio', $event)" />
        </div>
        <div class="field">
          <label>Fecha terminación</label>
          <input
            type="date"
            [value]="experiencia().fechaTerminacion || ''"
            [disabled]="experiencia().actual"
            (input)="setCampo('fechaTerminacion', $event)"
          />
          <label class="radio-option" style="margin-top: 4px">
            <input type="checkbox" [checked]="!!experiencia().actual" (change)="setActual($event)" />
            Trabajo actualmente aquí
          </label>
        </div>
        <div class="field">
          <label>Tiempo total laborado</label>
          <input type="text" [value]="experiencia().tiempoLaborado || '—'" disabled readonly />
        </div>
        <div class="field">
          <label>Dedicación</label>
          <select [ngModel]="experiencia().dedicacion || ''" (ngModelChange)="set({ dedicacion: $event })">
            <option value="">Seleccione…</option>
            <option>Tiempo completo</option>
            <option>Medio tiempo</option>
            <option>Tiempo parcial</option>
          </select>
        </div>
        <div class="field field--span2">
          <label>Motivo de retiro</label>
          <input type="text" [value]="experiencia().motivoRetiro || ''" (input)="setCampo('motivoRetiro', $event)" />
        </div>
      </div>
    </div>
  `,
})
export class ExperienciaCard {
  readonly experiencia = input.required<any>();
  readonly index = input<number>(0);
  readonly cambiar = output<{ id: string; patch: any }>();
  readonly quitar = output<string>();

  protected readonly paises = PAISES;
  protected readonly departamentos = DEPARTAMENTOS;
  protected readonly municipios = MUNICIPIOS_POR_DEPARTAMENTO;
  protected readonly sinOpciones: string[] = [];

  protected esColombia(): boolean {
    return _esColombia(this.experiencia().pais);
  }

  protected set(patch: any): void {
    const exp = this.experiencia();
    const merged = { ...exp, ...patch };
    merged.tiempoLaborado = calcularTiempoLaborado(merged.fechaInicio, merged.actual ? null : merged.fechaTerminacion);
    this.cambiar.emit({ id: exp.id, patch: { ...patch, tiempoLaborado: merged.tiempoLaborado } });
  }

  protected setCampo(key: string, e: Event): void {
    this.set({ [key]: (e.target as HTMLInputElement).value });
  }

  protected setActual(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.set({ actual: checked, fechaTerminacion: checked ? '' : this.experiencia().fechaTerminacion });
  }
}
