import { Component, booleanAttribute, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Field } from '../field';
import { SelectConOtro } from '../select-con-otro';
import { MUNICIPIOS_POR_DEPARTAMENTO, DEPARTAMENTOS } from '../../data/municipiosPorDepartamento';
import { PAISES } from '../../data/paises';


@Component({
  selector: 'app-hoja-i',
  imports: [FormsModule, Field, SelectConOtro],
  host: { style: 'display: contents' },
  template: `
    <section>
      <h2 class="section-title">Datos Personales y Familiares</h2>
      <p class="section-intro">Diligencie su información básica de contacto e identificación.</p>

      <div class="field-grid">
        @if (!ocultarProceso()) {
          <app-field label="Proceso de selección No.">
            <input type="text" [value]="datos().proceso" (input)="set('proceso', $event)" [disabled]="datos().urlLocked" />
          </app-field>
          <app-field label="Fecha de entrega">
            <input type="date" [value]="datos().fechaEntrega" (input)="set('fechaEntrega', $event)" [disabled]="datos().urlLocked" />
          </app-field>
        }

        <app-field label="Nombre completo *" span2 [error]="errors().nombreCompleto">
          <input type="text" autocomplete="name" [value]="datos().nombreCompleto" (input)="set('nombreCompleto', $event)" />
        </app-field>

        <app-field label="Cédula No. *" [error]="errors().cedula">
          <input type="text" [value]="datos().cedula" (input)="set('cedula', $event)" />
        </app-field>
        <app-field label="De (lugar de expedición) *" [error]="errors().cedulaDe">
          <input type="text" [value]="datos().cedulaDe" (input)="set('cedulaDe', $event)" />
        </app-field>

        <app-field label="Departamento de nacimiento *" [error]="errors().deptoNacimiento">
          <app-select-con-otro
            [value]="datos().deptoNacimiento"
            [opciones]="departamentos"
            (changed)="setDatos.emit({ deptoNacimiento: $event, ciudadNacimiento: '' })"
          />
        </app-field>
        <app-field label="Ciudad de nacimiento *" [error]="errors().ciudadNacimiento">
          <app-select-con-otro
            [clave]="datos().deptoNacimiento"
            [value]="datos().ciudadNacimiento"
            [opciones]="municipios[datos().deptoNacimiento] || sinOpciones"
            (changed)="setDatos.emit({ ciudadNacimiento: $event })"
            [placeholder]="datos().deptoNacimiento ? 'Seleccione…' : 'Elige primero el departamento'"
          />
        </app-field>
        <app-field label="País de nacimiento *" [error]="errors().paisNacimiento">
          <select [ngModel]="datos().paisNacimiento" (ngModelChange)="setDatos.emit({ paisNacimiento: $event })">
            <option value="">Seleccione…</option>
            @for (p of paises; track p) {
              <option [value]="p">{{ p }}</option>
            }
          </select>
        </app-field>
        <app-field label="Fecha de nacimiento *" [error]="errors().fechaNacimiento">
          <input type="date" autocomplete="bday" [value]="datos().fechaNacimiento" (input)="set('fechaNacimiento', $event)" />
        </app-field>

        <app-field label="¿Tiene licencia de conducción?">
          <div class="radio-row">
            <label class="radio-option">
              <input type="radio" name="licencia" [checked]="datos().licencia === 'si'" (change)="setDatos.emit({ licencia: 'si' })" /> Sí
            </label>
            <label class="radio-option">
              <input type="radio" name="licencia" [checked]="datos().licencia === 'no'" (change)="setDatos.emit({ licencia: 'no', licenciaClase: '' })" /> No
            </label>
          </div>
        </app-field>
        <app-field label="Clase">
          <input type="text" [value]="datos().licenciaClase" (input)="set('licenciaClase', $event)" [disabled]="datos().licencia !== 'si'" />
        </app-field>
        <app-field label="¿Tiene vehículo?">
          <div class="radio-row">
            <label class="radio-option">
              <input type="radio" name="tieneVehiculo" [checked]="datos().tieneVehiculo === 'si'" (change)="setDatos.emit({ tieneVehiculo: 'si' })" /> Sí
            </label>
            <label class="radio-option">
              <input type="radio" name="tieneVehiculo" [checked]="datos().tieneVehiculo === 'no'" (change)="setDatos.emit({ tieneVehiculo: 'no' })" /> No
            </label>
          </div>
        </app-field>

        <app-field label="Correo electrónico *" span2 [error]="errors().correo">
          <input type="email" autocomplete="email" spellcheck="false" [value]="datos().correo" (input)="set('correo', $event)" />
        </app-field>

        <app-field label="Dirección de residencia *" span2 [error]="errors().direccion">
          <input type="text" autocomplete="street-address" [value]="datos().direccion" (input)="set('direccion', $event)" />
        </app-field>
        <app-field label="Departamento *" [error]="errors().deptoResidencia">
          <app-select-con-otro
            [value]="datos().deptoResidencia"
            [opciones]="departamentos"
            (changed)="setDatos.emit({ deptoResidencia: $event, municipio: '' })"
          />
        </app-field>
        <app-field label="Municipio *" [error]="errors().municipio">
          <app-select-con-otro
            [clave]="datos().deptoResidencia"
            [value]="datos().municipio"
            [opciones]="municipios[datos().deptoResidencia] || sinOpciones"
            (changed)="setDatos.emit({ municipio: $event })"
            [placeholder]="datos().deptoResidencia ? 'Seleccione…' : 'Elige primero el departamento'"
          />
        </app-field>

        <app-field label="Teléfono residencia">
          <input type="tel" autocomplete="tel" [value]="datos().telResidencia" (input)="set('telResidencia', $event)" />
        </app-field>
        <app-field label="Celular *" [error]="errors().celular">
          <input type="tel" autocomplete="tel" [value]="datos().celular" (input)="set('celular', $event)" />
        </app-field>

        <app-field label="Estado civil *" [error]="errors().estadoCivil">
          <select [ngModel]="datos().estadoCivil" (ngModelChange)="setDatos.emit({ estadoCivil: $event })">
            <option value="">Seleccione…</option>
            <option>Soltero(a)</option>
            <option>Casado(a)</option>
            <option>Unión libre</option>
            <option>Separado(a)</option>
            <option>Divorciado(a)</option>
            <option>Viudo(a)</option>
          </select>
        </app-field>
        <app-field label="N° de hijos *" [error]="errors().numHijos">
          <input type="number" min="0" [value]="datos().numHijos" (input)="set('numHijos', $event)" />
        </app-field>

        <app-field label="Tarjeta o matrícula profesional N° *" [error]="errors().tarjetaProfesional">
          <input type="text" [value]="datos().tarjetaProfesional" (input)="set('tarjetaProfesional', $event)" />
        </app-field>
        <app-field label="Profesión *" [error]="errors().profesion">
          <input type="text" [value]="datos().profesion" (input)="set('profesion', $event)" />
        </app-field>
        <app-field label="Fecha de expedición">
          <input type="date" [value]="datos().fechaTarjeta" (input)="set('fechaTarjeta', $event)" />
        </app-field>
      </div>
    </section>
  `,
})
export class HojaI {
  readonly datos = input.required<any>();
  readonly errors = input<any>({});
  readonly ocultarProceso = input(false, { transform: booleanAttribute });
  readonly setDatos = output<any>();

  protected readonly departamentos = DEPARTAMENTOS;
  protected readonly municipios = MUNICIPIOS_POR_DEPARTAMENTO;
  protected readonly paises = PAISES;
  protected readonly sinOpciones: string[] = [];

  protected set(key: string, e: Event): void {
    this.setDatos.emit({ [key]: (e.target as HTMLInputElement).value });
  }
}
