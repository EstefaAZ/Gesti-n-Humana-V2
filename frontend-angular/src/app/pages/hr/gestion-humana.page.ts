import { Component } from '@angular/core';
import { DocHeader } from '../../components/doc-header';
import { VacantesTab } from './vacantes-tab';

@Component({
  selector: 'app-gestion-humana-page',
  imports: [DocHeader, VacantesTab],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Procesos de Selección" [showCode]="false" />
    <main class="page">
      <app-vacantes-tab />
    </main>
  `,
})
export class GestionHumanaPage {}
