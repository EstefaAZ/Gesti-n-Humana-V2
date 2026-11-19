import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/** Equivalente del `autoFocus` de React: enfoca el elemento apenas se monta. */
@Directive({ selector: '[appAutofocus]' })
export class Autofocus implements AfterViewInit {
  private readonly el = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    this.el.nativeElement.focus();
  }
}
