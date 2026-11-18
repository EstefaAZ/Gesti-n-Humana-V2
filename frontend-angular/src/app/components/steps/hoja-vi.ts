import { Component, input, output } from '@angular/core';
import { ExperienciaCard } from './experiencia-card';

const MAX_EXPERIENCIAS = 10;

@Component({
  selector: 'app-hoja-vi',
  imports: [ExperienciaCard],
  host: { style: 'display: contents' },
  template: `
    <section>
      <h2 class="section-title">Experiencia Laboral</h2>
      <p class="section-intro">
        Use el botón "Agregar otra experiencia laboral" tantas veces como necesite para registrar todas sus
        experiencias (máximo 10). Durante el proceso de selección, Aguas Nacionales EPM S.A E.S.P. solicitará
        certificación escrita, con descripción de funciones, de la empresa para la cual usted trabajó — describa
        únicamente experiencias relacionadas con el cargo al que aspira y absténgase de describir cargos y funciones
        que no puedan ser certificadas. Si en una misma empresa ha laborado en varios cargos, regístrelos por separado.
      </p>

      @if (experiencias().length === 0) {
        <div class="empty-state">Aún no ha agregado ninguna experiencia laboral.</div>
      }

      @for (exp of experiencias(); track exp.id; let i = $index) {
        <app-experiencia-card [experiencia]="exp" [index]="i" (cambiar)="cambiar.emit($event)" (quitar)="quitar.emit($event)" />
      }

      <button type="button" class="btn btn-add btn-block" [disabled]="experiencias().length >= max" (click)="agregar.emit()">
        + Agregar otra experiencia laboral
      </button>
      <p class="limit-note" [class.is-at-max]="experiencias().length >= max">{{ experiencias().length }} de {{ max }} experiencias agregadas.</p>
    </section>
  `,
})
export class HojaVI {
  readonly experiencias = input<any[]>([]);
  readonly agregar = output<void>();
  readonly quitar = output<string>();
  readonly cambiar = output<{ id: string; patch: any }>();
  protected readonly max = MAX_EXPERIENCIAS;
}
