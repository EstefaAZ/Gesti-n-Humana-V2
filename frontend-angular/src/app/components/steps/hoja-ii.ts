import { Component, input, output } from '@angular/core';
import { RegistroIICard } from './registro-ii-card';

const MAX_REGISTROS = 15;

@Component({
  selector: 'app-hoja-ii',
  imports: [RegistroIICard],
  host: { style: 'display: contents' },
  template: `
    <section>
      <h2 class="section-title">Estudios, Cursos, Certificaciones e Idiomas</h2>
      <p class="section-intro">
        Agregue un registro por cada estudio, curso, certificación o idioma que desee declarar. Puede agregar hasta
        15 registros y eliminar cualquiera que haya agregado por error. Si necesita registrar más de 15, contacte a
        Gestión Humana para anexar la información adicional.
      </p>

      @if (registros().length === 0) {
        <div class="empty-state">Aún no ha agregado ningún registro. Use el botón de abajo para comenzar.</div>
      }

      @for (r of registros(); track r.id; let i = $index) {
        <app-registro-ii-card [registro]="r" [index]="i" (cambiar)="cambiar.emit($event)" (quitar)="quitar.emit($event)" />
      }

      <button type="button" class="btn btn-add btn-block" [disabled]="registros().length >= max" (click)="agregar.emit()">
        + Agregar registro
      </button>
      <p class="limit-note" [class.is-at-max]="registros().length >= max">{{ registros().length }} de {{ max }} registros agregados.</p>
    </section>
  `,
})
export class HojaII {
  readonly registros = input<any[]>([]);
  readonly agregar = output<void>();
  readonly quitar = output<string>();
  readonly cambiar = output<{ id: string; patch: any }>();
  protected readonly max = MAX_REGISTROS;
}
