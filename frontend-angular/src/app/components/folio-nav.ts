import { Component, input } from '@angular/core';

const STEP_LABELS: Record<string, string> = {
  I: 'Datos personales',
  II: 'Estudios',
  VI: 'Experiencia',
  VII: 'Conflicto de interés',
  VIII: 'Autorización',
  DOCS: 'Documentos',
};

@Component({
  selector: 'app-folio-nav',
  host: { style: 'display: contents' },
  template: `
    <div class="folio-nav" tabindex="0" role="group" aria-label="Pasos del formulario">
      @for (step of steps(); track step) {
        <div class="folio-tab" [class.is-active]="step === activeStep()" [class.is-done]="doneSteps().includes(step)" [attr.aria-current]="step === activeStep() ? 'step' : null">
          <span class="folio-tab__numeral">{{ step }}</span>
          <span class="folio-tab__label">{{ labels[step] }}</span>
        </div>
      }
    </div>
  `,
})
export class FolioNav {
  readonly steps = input<string[]>([]);
  readonly activeStep = input<string>('');
  readonly doneSteps = input<string[]>([]);
  protected readonly labels = STEP_LABELS;
}
