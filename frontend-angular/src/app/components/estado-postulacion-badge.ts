import { Component, input } from '@angular/core';

const CLASE_POR_ESTADO: Record<string, string> = {
  Recibida: 'estado-badge--recibida',
  'En revisión': 'estado-badge--en-revision',
  Preseleccionado: 'estado-badge--preseleccionado',
  'Entrevista programada': 'estado-badge--entrevista',
  Rechazada: 'estado-badge--rechazada',
  Aceptada: 'estado-badge--aceptada',
  Retirada: 'estado-badge--retirada',
};

@Component({
  selector: 'app-estado-postulacion-badge',
  host: { style: 'display: contents' },
  template: `<span class="estado-badge {{ clase() }}">{{ estado() }}</span>`,
})
export class EstadoPostulacionBadge {
  readonly estado = input<string>('');
  protected clase(): string {
    return CLASE_POR_ESTADO[this.estado()] || 'estado-badge--recibida';
  }
}
