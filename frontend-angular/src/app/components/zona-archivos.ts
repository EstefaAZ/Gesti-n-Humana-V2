import { Component, booleanAttribute, input, output, signal } from '@angular/core';
import { Icon } from '../shared/icon';

/**
 * Zona para subir archivos con el patrón de la app: recuadro punteado donde se
 * pueden soltar archivos desde el computador, con un botón secundario adentro
 * que abre el selector. Reemplaza al <input type="file"> del navegador.
 * En pantallas táctiles solo se muestra el botón (arrastrar no aplica).
 * Emite los archivos que cumplen `accept`; los demás se avisan en la zona.
 */
@Component({
  selector: 'app-zona-archivos',
  imports: [Icon],
  host: { style: 'display: contents' },
  template: `
    <div
      class="zona-archivos"
      [class.is-encima]="encima()"
      [class.is-deshabilitada]="disabled()"
      (dragover)="onDragOver($event)"
      (dragleave)="encima.set(false)"
      (drop)="onDrop($event)"
    >
      <span class="zona-archivos__icono" aria-hidden="true"><app-icon name="subir" [size]="18" [strokeWidth]="1.8" /></span>
      <p class="zona-archivos__texto" aria-hidden="true">
        <strong>Arrastra {{ multiple() ? 'los archivos' : 'el archivo' }} aquí</strong> o
      </p>
      <!-- Oculto: lo abre el botón (se puede estilizar y usar con teclado). -->
      <input
        #selector
        type="file"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        [accept]="accept()"
        [multiple]="multiple()"
        (change)="onElegidos($event)"
      />
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        [disabled]="disabled()"
        [attr.aria-label]="etiqueta() ? textoBoton() + ': ' + etiqueta() : null"
        (click)="selector.click()"
      >
        <app-icon name="subir" [size]="15" [strokeWidth]="2" /> {{ textoBoton() }}
      </button>
      @if (aviso()) {
        <p class="zona-archivos__aviso" role="alert">{{ aviso() }}</p>
      }
    </div>
  `,
})
export class ZonaArchivos {
  /** Igual que el atributo accept del input: "application/pdf,image/*". */
  readonly accept = input<string>('');
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly textoBoton = input<string>('Elegir archivo');
  /** Para el lector de pantalla: a qué categoría corresponde (ej. "Certificados laborales"). */
  readonly etiqueta = input<string>('');
  /** Texto que se muestra si se sueltan archivos de otro tipo. */
  readonly textoTipos = input<string>('');

  readonly archivos = output<File[]>();

  protected readonly encima = signal(false);
  protected readonly aviso = signal('');

  protected onDragOver(e: DragEvent): void {
    if (this.disabled()) return;
    e.preventDefault(); // sin esto el navegador abre el archivo en vez de soltarlo aquí
    this.encima.set(true);
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.encima.set(false);
    if (this.disabled()) return;
    const lista = Array.from(e.dataTransfer?.files || []);
    this.entregar(this.multiple() ? lista : lista.slice(0, 1));
  }

  protected onElegidos(e: Event): void {
    const el = e.target as HTMLInputElement;
    const lista = Array.from(el.files || []);
    el.value = ''; // permite volver a elegir el mismo archivo si lo quita y lo agrega de nuevo
    this.entregar(lista);
  }

  private entregar(lista: File[]): void {
    // El selector ya filtra por accept, pero lo que se suelta arrastrando no: se revisa aquí.
    const validos = lista.filter((f) => this.cumpleAccept(f));
    const rechazados = lista.length - validos.length;
    this.aviso.set(
      rechazados > 0
        ? `${rechazados === 1 ? 'Un archivo no se agregó' : `${rechazados} archivos no se agregaron`}: ${this.textoTipos() || 'el tipo de archivo no está permitido'}.`
        : '',
    );
    if (validos.length > 0) this.archivos.emit(validos);
  }

  private cumpleAccept(f: File): boolean {
    const reglas = this.accept().split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
    if (reglas.length === 0) return true;
    const tipo = (f.type || '').toLowerCase();
    const nombre = f.name.toLowerCase();
    return reglas.some((r) =>
      r.startsWith('.') ? nombre.endsWith(r) : r.endsWith('/*') ? tipo.startsWith(r.slice(0, -1)) : tipo === r,
    );
  }
}

/** "248 KB", "1,2 MB". Para archivos guardados en base64 se calcula desde su largo. */
export function pesoLegible(bytes: number): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
}

export function pesoDeBase64(base64: string | null | undefined): number {
  if (!base64) return 0;
  const relleno = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - relleno;
}
