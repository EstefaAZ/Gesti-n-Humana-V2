import { Component, input } from '@angular/core';
import { NotificationBell } from './notification-bell';

// El código del formato (GTH-FOR-03 · Versión · Fecha) ya no se muestra en la app
// web; solo aparece en el PDF de la solicitud, que es el documento oficial.
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
      </div>
    </header>
  `,
})
export class DocHeader {
  readonly title = input<string>('');
}
