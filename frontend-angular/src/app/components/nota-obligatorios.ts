import { Component, input } from '@angular/core';

/**
 * Aviso al inicio de cada hoja del formulario: qué significa el "*".
 * `extra` agrega lo obligatorio que no es un campo (p. ej. "al menos un estudio").
 */
@Component({
  selector: 'app-nota-obligatorios',
  host: { style: 'display: contents' },
  template: `
    <p class="nota-obligatorios">
      Los campos marcados con <span class="nota-obligatorios__marca" aria-hidden="true">*</span><span class="sr-only">asterisco</span> son obligatorios.
      @if (extra()) {
        {{ extra() }}
      }
    </p>
  `,
})
export class NotaObligatorios {
  readonly extra = input<string>('');
}
