import { Component, input } from '@angular/core';

@Component({
  selector: 'app-evaluacion-badge',
  host: { style: 'display: contents' },
  template: `
    @if (evaluacion(); as ev) {
      <div>
        <span class="eval-badge" [class.eval-badge--ok]="ev.cumple" [class.eval-badge--warn]="!ev.cumple">
          {{ ev.cumple ? 'Cumple criterios' : 'No cumple (' + ev.motivos.length + ')' }}
        </span>
        @if (mostrarMotivos() && !ev.cumple && ev.motivos.length > 0) {
          <ul class="eval-motivos">
            @for (m of ev.motivos; track $index) {
              <li>{{ m }}</li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class EvaluacionBadge {
  readonly evaluacion = input<any>(null);
  readonly mostrarMotivos = input<boolean>(true);
}
