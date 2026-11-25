import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-confirmacion',
  imports: [RouterLink],
  host: { style: 'display: contents' },
  template: `
    <section class="confirmation">
      <div class="confirmation__badge">✓</div>
      <h2 class="section-title text-center">Solicitud recibida</h2>
      <p class="text-muted">
        Su solicitud ha sido registrada correctamente. Guarde este número de radicado para consultar el estado de su proceso.
      </p>
      <div class="confirmation__radicado">{{ radicado() }}</div>
      <div class="confirmation__actions">
        <button type="button" class="btn btn-primary" (click)="descargarPdf.emit()">Descargar PDF de mi solicitud</button>
        <a routerLink="/mis-postulaciones" class="btn btn-secondary">Ver mis postulaciones</a>
      </div>
    </section>
  `,
})
export class Confirmacion {
  readonly radicado = input<string | null>(null);
  readonly descargarPdf = output<void>();
}
