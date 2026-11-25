import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './components/sidebar';

/**
 * Layout de las rutas con sesión: sidebar + contenido. Es una ruta de layout
 * (ver app.routes.ts), así que se crea una sola vez y las páginas hijas no se
 * recrean al iniciar sesión (antes el layout dependía de `autenticado()` y la
 * página de destino se construía dos veces).
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar],
  host: { style: 'display: contents' },
  template: `
    <a class="skip-link" href="#contenido" (click)="saltarAlContenido($event)">Saltar al contenido</a>
    <div class="app-shell">
      <app-sidebar />
      <!-- Cada página trae su propio <main>; este contenedor ya no lo duplica. -->
      <div class="app-shell__main" id="contenido" tabindex="-1">
        <router-outlet />
      </div>
    </div>
  `,
})
export class Shell {
  /** Lleva el foco al contenido sin cambiar la URL (el enlace de "saltar" no es una ruta). */
  protected saltarAlContenido(e: Event): void {
    e.preventDefault();
    const destino = document.getElementById('contenido');
    destino?.focus();
    destino?.scrollIntoView();
  }
}
