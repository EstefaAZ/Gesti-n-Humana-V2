import { Component, input, signal } from '@angular/core';
import { Icon } from '../shared/icon';

/**
 * "Descargar todos (ZIP)": descarga de una vez todos los documentos adjuntos.
 * El servidor arma el .zip, así que mientras tanto el botón dice "Preparando…".
 */
@Component({
  selector: 'app-boton-descargar-todos',
  imports: [Icon],
  host: { style: 'display: contents' },
  template: `
    <button type="button" class="btn btn-secondary btn-sm" (click)="ejecutar()" [disabled]="preparando()" [attr.aria-busy]="preparando()">
      <app-icon name="descargar" [size]="14" [strokeWidth]="2" />
      {{ preparando() ? 'Preparando…' : etiqueta() }}
    </button>
  `,
})
export class BotonDescargarTodos {
  readonly descargar = input.required<() => Promise<unknown>>();
  readonly etiqueta = input('Descargar todos (ZIP)');
  protected readonly preparando = signal(false);

  protected async ejecutar(): Promise<void> {
    this.preparando.set(true);
    try {
      await this.descargar()();
    } catch (e: any) {
      // El servidor explica el motivo (p. ej. "No hay documentos adjuntos para descargar.").
      alert(typeof e?.detail === 'string' && e.detail ? e.detail : 'No se pudieron descargar los documentos. Intenta de nuevo.');
    } finally {
      this.preparando.set(false);
    }
  }
}
