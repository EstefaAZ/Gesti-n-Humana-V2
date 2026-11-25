import { Component, effect, input, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PARENTESCOS } from '../../data/catalogos';
import { Icon } from '../../shared/icon';

const MAX_FAMILIARES = 5;

import { CampoAccesible } from '../../shared/campo-accesible';
import { NotaObligatorios } from '../nota-obligatorios';

@Component({
  selector: 'app-hoja-vii',
  imports: [NotaObligatorios, CampoAccesible, FormsModule, Icon],
  host: { style: 'display: contents' },
  template: `
    <section>
      <h2 class="section-title">Declaración Conflicto de Interés</h2>
      <app-nota-obligatorios />

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
        <!-- Panel de la respuesta "Sí": línea verde al costado para que se lea como parte de la pregunta. -->
        <div class="panel-si">
          @if (conflicto().familiares.length === 0) {
            <div class="vacio">
              <span class="vacio__icono" aria-hidden="true"><app-icon name="users" [size]="20" [strokeWidth]="1.8" /></span>
              <div class="vacio__texto">
                <p class="vacio__titulo">Agrega a la persona con quien tienes el vínculo</p>
                <p class="vacio__ayuda">Su parentesco contigo, su nombre y su cargo en la empresa. Puedes agregar hasta {{ max }}.</p>
              </div>
              <button type="button" class="btn btn-primary" (click)="agregarFamiliar.emit()">
                <app-icon name="mas" [size]="16" [strokeWidth]="2.2" /> Agregar familiar
              </button>
            </div>
          } @else {
            <ul class="lista-familiares">
              @for (f of conflicto().familiares; track f.id; let i = $index) {
                <li class="familiar" [id]="'familiar-' + f.id">
                  <div class="field">
                    <label>Parentesco</label>
                    <select [ngModel]="f.parentesco" (ngModelChange)="cambiarFamiliar.emit({ id: f.id, patch: { parentesco: $event } })">
                      <option value="">Seleccione…</option>
                      @for (p of parentescos; track p) {
                        <option [value]="p">{{ p }}</option>
                      }
                    </select>
                  </div>
                  <div class="field">
                    <label>Nombre del empleado</label>
                    <input type="text" [value]="f.nombreEmpleado" (input)="cambiarFamiliar.emit({ id: f.id, patch: { nombreEmpleado: $any($event.target).value } })" />
                  </div>
                  <div class="field">
                    <label>Cargo</label>
                    <input type="text" [value]="f.cargo" (input)="cambiarFamiliar.emit({ id: f.id, patch: { cargo: $any($event.target).value } })" />
                  </div>
                  <button
                    type="button"
                    class="reg__quitar familiar__quitar"
                    title="Eliminar"
                    [attr.aria-label]="'Eliminar familiar ' + (i + 1) + (f.nombreEmpleado ? ': ' + f.nombreEmpleado : '')"
                    (click)="quitarFamiliar.emit(f.id)"
                  >
                    <app-icon name="papelera" [size]="17" [strokeWidth]="1.8" />
                  </button>
                </li>
              }
            </ul>
            <div class="pie-registros">
              <button type="button" class="btn btn-secondary" [disabled]="conflicto().familiares.length >= max" (click)="agregarFamiliar.emit()">
                <app-icon name="mas" [size]="16" [strokeWidth]="2.2" /> Agregar otro familiar
              </button>
              <span class="pie-registros__contador" [class.is-al-maximo]="conflicto().familiares.length >= max">
                {{ conflicto().familiares.length >= max ? 'Llegaste al máximo de ' + max : conflicto().familiares.length + ' de ' + max }}
              </span>
            </div>
          }
          @if (errors().familiares) {
            <p class="field-error" style="display: block; margin: 0">{{ errors().familiares }}</p>
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
        <div class="panel-si">
        <div class="field" [class.is-invalid]="!!errors().descripcionInhabilidad" style="margin: 0">
          <label>Describa la situación *</label>
          <textarea [value]="conflicto().descripcionInhabilidad" (input)="setConflicto.emit({ descripcionInhabilidad: $any($event.target).value })"></textarea>
          @if (errors().descripcionInhabilidad) {
            <span class="field-error">{{ errors().descripcionInhabilidad }}</span>
          }
        </div>
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

  // Al agregar un familiar, el foco va a su primer campo (Parentesco).
  private conteoPrevio = -1;
  constructor() {
    effect(() => {
      const lista = this.conflicto().familiares || [];
      untracked(() => {
        if (this.conteoPrevio >= 0 && lista.length > this.conteoPrevio) {
          const nuevo = lista[lista.length - 1];
          setTimeout(() => document.querySelector<HTMLElement>(`#familiar-${nuevo.id} select`)?.focus());
        }
        this.conteoPrevio = lista.length;
      });
    });
  }

  protected setVinculo(val: string): void {
    if (val === 'si') {
      this.setConflicto.emit({ tieneVinculo: val });
    } else {
      this.setConflicto.emit({ tieneVinculo: val, familiares: [] });
    }
  }
}
