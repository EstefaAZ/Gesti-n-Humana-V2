import { Component, ElementRef, HostListener, input, signal, viewChild } from '@angular/core';

export interface Accion {
  etiqueta: string;
  onClick: () => void;
  danger?: boolean;
}

/**
 * Botón "⋮" que despliega una lista de acciones. `acciones` es un arreglo de
 * { etiqueta, onClick, danger? }. Se cierra al hacer clic afuera, con Esc o al
 * elegir una acción. La lista se posiciona fija junto al botón para que una
 * tabla con scroll horizontal no la recorte.
 */
@Component({
  selector: 'app-acciones-menu',
  host: { style: 'display: contents' },
  template: `
    <div class="acciones-menu" #contenedor>
      <button
        #boton
        type="button"
        class="acciones-menu__boton"
        (click)="alternar()"
        aria-label="Más acciones"
        aria-haspopup="menu"
        [attr.aria-expanded]="abierto()"
      >
        ⋮
      </button>
      @if (abierto()) {
        <div
          class="acciones-menu__lista acciones-menu__lista--fija"
          role="menu"
          [style.top.px]="posicion().top"
          [style.left.px]="posicion().left"
        >
          @for (a of acciones(); track $index) {
            <button
              type="button"
              role="menuitem"
              class="acciones-menu__item"
              [class.acciones-menu__item--danger]="a.danger"
              (click)="elegir(a)"
            >
              {{ a.etiqueta }}
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class AccionesMenu {
  readonly acciones = input<Accion[]>([]);
  protected readonly abierto = signal(false);
  protected readonly posicion = signal({ top: 0, left: 0 });
  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  private readonly boton = viewChild.required<ElementRef<HTMLButtonElement>>('boton');

  protected alternar(): void {
    if (this.abierto()) {
      this.abierto.set(false);
      return;
    }
    const r = this.boton().nativeElement.getBoundingClientRect();
    const ancho = 170;
    this.posicion.set({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8)) });
    this.abierto.set(true);
    // Lleva el foco a la primera opción para poder seguir con el teclado.
    setTimeout(() => (this.contenedor().nativeElement.querySelector('[role=menuitem]') as HTMLElement | null)?.focus());
  }

  @HostListener('document:mousedown', ['$event'])
  onClickAfuera(e: MouseEvent): void {
    if (!this.abierto()) return;
    if (!this.contenedor().nativeElement.contains(e.target as Node)) this.abierto.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.abierto()) return;
    this.abierto.set(false);
    this.boton().nativeElement.focus();
  }

  /** Al hacer scroll la lista fija quedaría despegada del botón: se cierra. */
  @HostListener('window:scroll')
  @HostListener('window:resize')
  onMover(): void {
    if (this.abierto()) this.abierto.set(false);
  }

  protected elegir(a: Accion): void {
    this.abierto.set(false);
    a.onClick();
  }
}
