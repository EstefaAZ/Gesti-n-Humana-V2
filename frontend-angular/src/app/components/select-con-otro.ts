import { Component, OnChanges, SimpleChanges, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** minúsculas y sin tildes — para comparar valores guardados antes de que existiera el catálogo. */
function _normalizar(texto: string | null | undefined): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Un <select> con las opciones dadas + "Otro" al final. Si el usuario elige
 * "Otro", cambia a un campo de texto libre (con un enlace para volver a la
 * lista). Si `opciones` viene vacío (por ejemplo, ciudad sin departamento
 * elegido todavía), se muestra directamente como texto libre.
 *
 * El match contra `opciones` es tolerante a tildes/mayúsculas: un valor
 * guardado como "Ingles" preselecciona "Inglés" del catálogo en vez de caer
 * a modo texto libre solo por la tilde.
 *
 * `clave` cumple el papel del `key` de React: cuando cambia (ej. otro
 * departamento elegido), el componente se reinicia como si fuera nuevo.
 */
@Component({
  selector: 'app-select-con-otro',
  imports: [FormsModule],
  host: { style: 'display: contents' },
  template: `
    @if (sinOpciones() || modoTexto()) {
      <div>
        <input
          type="text"
          [value]="value() ?? ''"
          (input)="changed.emit($any($event.target).value)"
          [disabled]="disabled()"
          [placeholder]="sinOpciones() ? placeholder() : 'Escribe el nombre…'"
        />
        @if (!sinOpciones()) {
          <button type="button" class="btn-link" style="font-size: 11.5px; margin-top: 4px; padding: 0" (click)="volverALista()">
            ‹ Elegir de la lista
          </button>
        }
      </div>
    } @else {
      <select [ngModel]="opcionCoincidente() || value()" [disabled]="disabled()" (ngModelChange)="onSelect($event)">
        <option value="">{{ placeholder() }}</option>
        @for (o of opciones(); track o) {
          <option [value]="o">{{ o }}</option>
        }
        <option value="__OTRO__">Otro</option>
      </select>
    }
  `,
})
export class SelectConOtro implements OnChanges {
  readonly value = input<string>('');
  readonly opciones = input<string[]>([]);
  readonly placeholder = input<string>('Seleccione…');
  readonly disabled = input<boolean>(false);
  readonly clave = input<any>(undefined);
  readonly changed = output<string>();

  protected readonly modoTexto = signal(false);

  protected opcionCoincidente(): string | undefined {
    const v = _normalizar(this.value());
    return this.opciones().find((o) => _normalizar(o) === v);
  }

  protected sinOpciones(): boolean {
    return this.opciones().length === 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Estado inicial (al montar) y cada vez que cambia la `clave` (remontaje en React).
    if (changes['clave'] || (changes['value'] && changes['value'].firstChange)) {
      this.modoTexto.set((this.value() ?? '') !== '' && !this.opcionCoincidente());
    }
  }

  protected onSelect(valor: string): void {
    if (valor === '__OTRO__') {
      this.modoTexto.set(true);
      this.changed.emit('');
    } else {
      this.changed.emit(valor);
    }
  }

  protected volverALista(): void {
    this.modoTexto.set(false);
    this.changed.emit('');
  }
}
