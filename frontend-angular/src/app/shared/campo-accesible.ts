import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

let secuencia = 0;

/**
 * Se aplica solo a cada `.field` (etiqueta + control) y conecta la etiqueta con
 * su control: `for`/`id` para inputs, selects y textareas, y `radiogroup`
 * con `aria-labelledby` para los grupos Sí/No. Así un lector de pantalla
 * anuncia "Celular, campo de texto" y un clic en la etiqueta enfoca el campo.
 * Vuelve a revisar cuando cambia el contenido del campo, porque algunos
 * controles aparecen después (p. ej. al elegir "Otro" en SelectConOtro).
 */
@Directive({ selector: '.field' })
export class CampoAccesible implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private observador?: MutationObserver;

  ngAfterViewInit(): void {
    this.conectar();
    this.observador = new MutationObserver(() => this.conectar());
    this.observador.observe(this.el.nativeElement, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  private conectar(): void {
    const campo = this.el.nativeElement as HTMLElement;
    const label = campo.querySelector(':scope > label') as HTMLLabelElement | null;
    if (!label || label.contains(campo.querySelector('input, select, textarea'))) return;
    if (!label.id) label.id = `campo-${++secuencia}-etiqueta`;

    const grupo = campo.querySelector('.radio-row');
    if (grupo) {
      grupo.setAttribute('role', 'radiogroup');
      grupo.setAttribute('aria-labelledby', label.id);
      return;
    }

    const control = campo.querySelector('input:not([type=radio]):not([type=checkbox]), select, textarea') as HTMLElement | null;
    if (!control) return;
    if (!control.id) control.id = `campo-${++secuencia}`;
    if (label.htmlFor !== control.id) label.htmlFor = control.id;
  }
}
