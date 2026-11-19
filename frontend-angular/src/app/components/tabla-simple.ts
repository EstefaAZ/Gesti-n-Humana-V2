import { Component, booleanAttribute, input } from '@angular/core';

/** Tabla de solo lectura (equivalente de la función tablaSimple() de React). */
@Component({
  selector: 'app-tabla-simple',
  host: { style: 'display: contents' },
  template: `
    @if (!filas() || filas()!.length === 0) {
      <p class="text-muted" style="font-size: 12.5px">Sin registros.</p>
    } @else {
      <table class="plain-table">
        @if (!sinEncabezado()) {
          <thead>
            <tr>
              @for (l of labels(); track l) {
                <th>{{ l }}</th>
              }
            </tr>
          </thead>
        }
        <tbody>
          @for (row of filas(); track $index) {
            <tr>
              @for (c of campos(); track c) {
                <td>{{ row[c] ?? '—' }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class TablaSimple {
  readonly filas = input<any[] | null | undefined>([]);
  readonly campos = input<string[]>([]);
  readonly labels = input<string[]>([]);
  readonly sinEncabezado = input(false, { transform: booleanAttribute });
}
