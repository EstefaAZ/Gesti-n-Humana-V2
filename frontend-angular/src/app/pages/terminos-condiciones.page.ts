import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocHeader } from '../components/doc-header';

@Component({
  selector: 'app-terminos-condiciones-page',
  imports: [RouterLink, DocHeader],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Términos y Condiciones" [showCode]="false" />
    <main class="page">
      <div class="card">
        <div class="notice notice--warning">
          Este documento está pendiente de publicación por parte del equipo Legal de Aguas Nacionales EPM.
          Cuando esté listo, este espacio mostrará el texto oficial completo.
        </div>
        <p class="text-center mt-24"><a routerLink="/registro" class="text-muted">← Volver al registro</a></p>
      </div>
    </main>
  `,
})
export class TerminosCondicionesPage {}
