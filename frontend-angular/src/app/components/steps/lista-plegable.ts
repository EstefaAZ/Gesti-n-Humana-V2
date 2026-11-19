import { effect, signal, untracked } from '@angular/core';

/**
 * Qué tarjeta de una lista de registros (Estudios, Experiencia) está abierta.
 * Se abre una sola a la vez. Cuando la lista crece (se agregó un registro), se
 * abre el nuevo y el foco va a su primer campo; "Listo" la cierra y devuelve el
 * foco al encabezado de la tarjeta, para no perder el lugar con el teclado.
 * Usar dentro del constructor (o como inicializador de campo) del componente.
 */
export class ListaPlegable {
  readonly abiertoId = signal<string | null>(null);
  private conteoPrevio = -1;

  constructor(lista: () => { id: string }[]) {
    effect(() => {
      const items = lista();
      untracked(() => {
        if (this.conteoPrevio >= 0 && items.length > this.conteoPrevio) {
          const nuevo = items[items.length - 1];
          this.abiertoId.set(nuevo.id);
          this.enfocar(`#reg-cuerpo-${nuevo.id}`, 'select, input, textarea');
        }
        if (this.abiertoId() && !items.some((i) => i.id === this.abiertoId())) this.abiertoId.set(null);
        this.conteoPrevio = items.length;
      });
    });
  }

  alternar(id: string): void {
    this.abiertoId.set(this.abiertoId() === id ? null : id);
  }

  listo(id: string): void {
    this.abiertoId.set(null);
    this.enfocar(`#reg-${id}`, '.reg__resumen');
  }

  private enfocar(contenedor: string, selector: string): void {
    // Espera a que Angular pinte la tarjeta abierta o cerrada.
    setTimeout(() => {
      const el = document.querySelector(contenedor)?.querySelector<HTMLElement>(selector);
      el?.focus();
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}

/** Une las partes no vacías: unir(['Universitario', '', 'UdeM']) → "Universitario · UdeM". */
export function unir(partes: (string | null | undefined)[], separador = ' · '): string {
  return partes.map((p) => (p || '').toString().trim()).filter(Boolean).join(separador);
}

/** "2016-06" o "2016-06-30" → "2016". */
export function anio(fecha: string | null | undefined): string {
  return /^\d{4}/.test(fecha || '') ? (fecha as string).slice(0, 4) : '';
}

const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];

/** "2017-02-01" → "feb. 2017" (sin pasar por Date, para no correr la fecha por zona horaria). */
export function mesAnio(fecha: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(fecha || '');
  return m ? `${MESES[Number(m[2]) - 1] || ''} ${m[1]}`.trim() : '';
}
