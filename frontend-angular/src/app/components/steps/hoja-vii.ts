import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PARENTESCOS } from '../../data/catalogos';

const MAX_FAMILIARES = 5;

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  selector: 'app-hoja-vii',
  imports: [CampoAccesible, FormsModule],
  host: { style: 'display: contents' },
  template: `
    <section>
      <h2 class="section-title">VII. Declaración Conflicto de Interés</h2>

      <div class="field" style="margin-bottom: 20px">
        <label>
          ¿Tiene algún vínculo con empleados o miembros de la Junta Directiva de Aguas Nacionales EPM (cónyuge o
          compañero permanente, padre, hijo, abuelo, nieto, hermano, tío, primo, sobrino, suegro, cuñado, nuera o
          yerno, hijo y/o padre por adopción)? *
        </label>
        <div class="radio-row">
          <label class="radio-option">
            <input type="radio" name="tieneVinculo" [checked]="conflicto().tieneVinculo === 'si'" (change)="setVinculo('si')" /> Sí
          </label>
          <label class="radio-option">
            <input type="radio" name="tieneVinculo" [checked]="conflicto().tieneVinculo === 'no'" (change)="setVinculo('no')" /> No
          </label>
        </div>
      </div>

      @if (conflicto().tieneVinculo === 'si') {
        <div>
          @if (conflicto().familiares.length === 0) {
            <div class="empty-state">Aún no ha agregado ningún familiar.</div>
          }
          @if (conflicto().familiares.length > 0) {
            <table class="plain-table">
              <thead>
                <tr>
                  <th>Parentesco / relación</th>
                  <th>Nombre del empleado</th>
                  <th>Cargo</th>
                  <th><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (f of conflicto().familiares; track f.id) {
                  <tr>
                    <td>
                      <select aria-label="Parentesco o relación" [ngModel]="f.parentesco" (ngModelChange)="cambiarFamiliar.emit({ id: f.id, patch: { parentesco: $event } })">
                        <option value="">Seleccione…</option>
                        @for (p of parentescos; track p) {
                          <option [value]="p">{{ p }}</option>
                        }
                      </select>
                    </td>
                    <td>
                      <input type="text" aria-label="Nombre del empleado" [value]="f.nombreEmpleado" (input)="cambiarFamiliar.emit({ id: f.id, patch: { nombreEmpleado: $any($event.target).value } })" />
                    </td>
                    <td>
                      <input type="text" aria-label="Cargo del empleado" [value]="f.cargo" (input)="cambiarFamiliar.emit({ id: f.id, patch: { cargo: $any($event.target).value } })" />
                    </td>
                    <td>
                      <button type="button" class="repeatable-block__remove" (click)="quitarFamiliar.emit(f.id)">Eliminar</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
          <button type="button" class="btn btn-add btn-block" [disabled]="conflicto().familiares.length >= max" (click)="agregarFamiliar.emit()">
            + Agregar otro familiar
          </button>
          <p class="limit-note" [class.is-at-max]="conflicto().familiares.length >= max">
            {{ conflicto().familiares.length }} de {{ max }} familiares agregados.
          </p>
          @if (errors().familiares) {
            <p class="field-error" style="display: block">{{ errors().familiares }}</p>
          }
        </div>
      }

      <div class="field" style="margin: 28px 0 16px">
        <label>¿Tiene alguna otra inhabilidad, incompatibilidad o conflicto de interés que deba declarar? *</label>
        <div class="radio-row">
          <label class="radio-option">
            <input
              type="radio"
              name="tieneOtraInhabilidad"
              [checked]="conflicto().tieneOtraInhabilidad === 'si'"
              (change)="setConflicto.emit({ tieneOtraInhabilidad: 'si' })"
            /> Sí
          </label>
          <label class="radio-option">
            <input
              type="radio"
              name="tieneOtraInhabilidad"
              [checked]="conflicto().tieneOtraInhabilidad === 'no'"
              (change)="setConflicto.emit({ tieneOtraInhabilidad: 'no', descripcionInhabilidad: '' })"
            /> No
          </label>
        </div>
      </div>

      @if (conflicto().tieneOtraInhabilidad === 'si') {
        <div class="field" [class.is-invalid]="!!errors().descripcionInhabilidad">
          <label>Describa la situación *</label>
          <textarea [value]="conflicto().descripcionInhabilidad" (input)="setConflicto.emit({ descripcionInhabilidad: $any($event.target).value })"></textarea>
          @if (errors().descripcionInhabilidad) {
            <span class="field-error">{{ errors().descripcionInhabilidad }}</span>
          }
        </div>
      }
    </section>
  `,
})
export class HojaVII {
  readonly conflicto = input.required<any>();
  readonly errors = input<any>({});
  readonly setConflicto = output<any>();
  readonly agregarFamiliar = output<void>();
  readonly quitarFamiliar = output<string>();
  readonly cambiarFamiliar = output<{ id: string; patch: any }>();

  protected readonly parentescos = PARENTESCOS;
  protected readonly max = MAX_FAMILIARES;

  protected setVinculo(val: string): void {
    if (val === 'si') {
      this.setConflicto.emit({ tieneVinculo: val });
    } else {
      this.setConflicto.emit({ tieneVinculo: val, familiares: [] });
    }
  }
}
