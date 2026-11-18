import { Component, input, output } from '@angular/core';

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  imports: [CampoAccesible],
  selector: 'app-hoja-viii',
  host: { style: 'display: contents' },
  template: `
    <section>
      <h2 class="section-title">Autorización del Aspirante</h2>

      <div class="clauses">
        <ol>
          <li>El aspirante declara que la información suministrada en este formato es verídica y verificable, y autoriza a Aguas Nacionales EPM a corroborarla por los medios que considere pertinentes.</li>
          <li>El aspirante autoriza el uso de la información aquí registrada exclusivamente para efectos del presente proceso de selección.</li>
          <li>El aspirante autoriza a Aguas Nacionales EPM a solicitar referencias laborales, personales y académicas relacionadas con la información aquí declarada.</li>
          <li>El aspirante entiende que la omisión o falsedad de la información suministrada puede dar lugar a la exclusión del proceso de selección en cualquier etapa.</li>
          <li>El aspirante autoriza el estudio de seguridad y verificación de antecedentes que la compañía considere necesarios conforme a la normatividad vigente.</li>
          <li>La información suministrada será tratada de forma confidencial y solo será conocida por las personas involucradas en el proceso de selección.</li>
          <li>El aspirante podrá ejercer en cualquier momento sus derechos de acceso, actualización, rectificación y supresión de sus datos personales, conforme a la normatividad vigente.</li>
          <li>El aspirante autoriza de manera previa, expresa e informada el tratamiento de sus datos personales por parte de Aguas Nacionales EPM, conforme a lo establecido en la Ley 1581 de 2012 y sus decretos reglamentarios.</li>
          <li>El aspirante reconoce que esta autorización es válida sin importar la modalidad (física o digital) en la que haya sido diligenciada y enviada, y que produce los mismos efectos jurídicos en cualquiera de ellas.</li>
        </ol>
      </div>

      @if (errors().aceptaClausulas) {
        <div class="notice notice--warning">Debe aceptar las condiciones y cláusulas para continuar.</div>
      }

      <div class="consent-box">
        <input type="checkbox" id="aceptaClausulas" [checked]="autorizacion().acepta" (change)="onAcepta($event)" />
        <label for="aceptaClausulas">He leído y acepto las condiciones y cláusulas anteriores</label>
      </div>

      <div class="field" [class.is-invalid]="!!errors().nombreAutorizacion">
        <label>Autorización del aspirante — Nombre completo *</label>
        <input
          type="text"
          [value]="autorizacion().nombreCompleto"
          [disabled]="!autorizacion().acepta"
          (input)="setAutorizacion.emit({ nombreCompleto: $any($event.target).value })"
        />
        <span class="hint">Este campo se habilita solo después de aceptar las cláusulas.</span>
        @if (errors().nombreAutorizacion) {
          <span class="field-error">{{ errors().nombreAutorizacion }}</span>
        }
      </div>
    </section>
  `,
})
export class HojaVIII {
  readonly autorizacion = input.required<any>();
  readonly errors = input<any>({});
  readonly setAutorizacion = output<any>();

  protected onAcepta(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.setAutorizacion.emit({ acepta: checked, nombreCompleto: checked ? this.autorizacion().nombreCompleto : '' });
  }
}
