import { Component, input } from '@angular/core';
import { NotificationBell } from './notification-bell';

@Component({
  selector: 'app-doc-header',
  imports: [NotificationBell],
  host: { style: 'display: contents' },
  template: `
    <header class="doc-header">
      <div class="doc-header__inner">
        <img src="assets/logo-aguas-nacionales.png" alt="Aguas Nacionales EPM" class="doc-header__logo" />
        <div class="doc-header__titles">
          <h1 class="doc-header__title">{{ title() }}</h1>
        </div>
        <app-notification-bell />
        @if (showCode()) {
          <div class="doc-header__code">
            Código: <strong>GTH-FOR-03</strong>
            <br />
            Versión: <strong>02</strong>
            <br />
            Fecha: <strong>03/08/2023</strong>
          </div>
        }
      </div>
    </header>
  `,
})
export class DocHeader {
  readonly title = input<string>('');
  readonly showCode = input<boolean>(true);
}
