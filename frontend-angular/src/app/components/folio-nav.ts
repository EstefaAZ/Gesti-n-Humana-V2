import { Component, computed, input } from '@angular/core';
import { Icon } from '../shared/icon';

// Nombre e ícono de cada paso. La clave sigue siendo el numeral del formato
// GTH-FOR-03 (I, II, VI…), pero ya no se muestra: en su lugar va un ícono.
export type DefinicionPaso = { nombre: string; icono: string };

const PASOS: Record<string, DefinicionPaso> = {
  I: { nombre: 'Datos personales', icono: 'persona' },
  II: { nombre: 'Estudios', icono: 'birrete' },
  VI: { nombre: 'Experiencia', icono: 'briefcase' },
  VII: { nombre: 'Conflicto de interés', icono: 'balanza' },
  DOCS: { nombre: 'Documentos', icono: 'documento' },
  VIII: { nombre: 'Autorización', icono: 'firma' },
};

/**
 * Línea de progreso del formulario por pasos (Completar perfil y Postularme).
 * Solo informa en qué paso se va: no se puede pulsar. Un círculo con ícono por
 * paso, unidos por una línea que se pinta de verde a medida que se avanza; el
 * paso terminado conserva su ícono y suma un ✓ en la esquina. En pantallas
 * angostas se ocultan los nombres y aparece "Paso N de M · Nombre".
 * Otro formulario (p. ej. Nueva vacante) puede pasar sus propios pasos en `definiciones`.
 */
@Component({
  selector: 'app-folio-nav',
  imports: [Icon],
  host: { style: 'display: contents' },
  template: `
    <nav class="pasos" aria-label="Pasos del formulario">
      <ol class="pasos__lista">
        @for (step of steps(); track step) {
          <li
            class="pasos__paso"
            [class.is-done]="doneSteps().includes(step)"
            [class.is-active]="step === activeStep()"
            [attr.aria-current]="step === activeStep() ? 'step' : null"
          >
            <span class="pasos__circulo" aria-hidden="true">
              <app-icon [name]="pasos()[step]?.icono || 'circle'" [size]="18" [strokeWidth]="1.8" />
            </span>
            <span class="pasos__nombre">
              {{ pasos()[step]?.nombre || step }}
              @if (doneSteps().includes(step) && step !== activeStep()) {
                <span class="sr-only">(completado)</span>
              }
            </span>
          </li>
        }
      </ol>
      <p class="pasos__resumen" aria-hidden="true">
        Paso {{ indiceActivo() + 1 }} de {{ steps().length }} · <strong>{{ pasos()[activeStep()]?.nombre || activeStep() }}</strong>
      </p>
    </nav>
  `,
})
export class FolioNav {
  readonly steps = input<string[]>([]);
  readonly activeStep = input<string>('');
  readonly doneSteps = input<string[]>([]);
  readonly definiciones = input<Record<string, DefinicionPaso> | null>(null);
  protected readonly pasos = computed(() => this.definiciones() ?? PASOS);
  protected readonly indiceActivo = computed(() => Math.max(0, this.steps().indexOf(this.activeStep())));
}
