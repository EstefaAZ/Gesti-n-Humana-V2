import { Component, booleanAttribute, input } from '@angular/core';

import { CampoAccesible } from '../shared/campo-accesible';

@Component({
  imports: [CampoAccesible],
  selector: 'app-field',
  host: { style: 'display: contents' },
  template: `
    <div class="field" [class.field--span2]="span2()" [class.is-invalid]="!!error()">
      <label>{{ label() }}</label>
      <ng-content />
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
      @if (error()) {
        <span class="field-error">{{ error() }}</span>
      }
    </div>
  `,
})
export class Field {
  readonly label = input<string>('');
  readonly error = input<string | undefined>(undefined);
  readonly span2 = input(false, { transform: booleanAttribute });
  readonly hint = input<string | undefined>(undefined);
}
