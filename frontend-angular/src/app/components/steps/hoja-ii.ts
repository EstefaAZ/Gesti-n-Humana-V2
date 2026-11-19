import { Component, input, output } from '@angular/core';
import { RegistroIICard } from './registro-ii-card';
import { Icon } from '../../shared/icon';
import { ListaPlegable } from './lista-plegable';

const MAX_REGISTROS = 15;

@Component({
  selector: 'app-hoja-ii',
  imports: [RegistroIICard, Icon],
  host: { style: 'display: contents' },
  template: `
    <section>
      <h2 class="section-title">Estudios, Cursos, Certificaciones e Idiomas</h2>
      <p class="section-intro">
        Agregue un registro por cada estudio, curso, certificación o idioma que desee declarar. Puede agregar hasta
        15 registros y eliminar cualquiera que haya agregado por error. Si necesita registrar más de 15, contacte a
        Gestión Humana para anexar la información adicional.
      </p>

      @if (errors()?.['registrosII']) {
        <div class="notice notice--danger" role="alert">{{ errors()['registrosII'] }}</div>
      }

      @if (registros().length === 0) {
        <div class="vacio">
          <span class="vacio__icono" aria-hidden="true"><app-icon name="birrete" [size]="20" [strokeWidth]="1.8" /></span>
          <div class="vacio__texto">
            <p class="vacio__titulo">Todavía no hay estudios</p>
            <p class="vacio__ayuda">Agrega tu título, cursos, certificaciones o idiomas. Puedes registrar hasta {{ max }}.</p>
          </div>
          <button type="button" class="btn btn-primary" (click)="agregar.emit()">
            <app-icon name="mas" [size]="16" [strokeWidth]="2.2" /> Agregar estudio
          </button>
        </div>
      } @else {
        <div class="lista-registros">
          @for (r of registros(); track r.id; let i = $index) {
            <app-registro-ii-card
              [registro]="r"
              [index]="i"
              [abierto]="lista.abiertoId() === r.id"
              (alternar)="lista.alternar(r.id)"
              (listo)="lista.listo(r.id)"
              (cambiar)="cambiar.emit($event)"
              (quitar)="quitar.emit($event)"
            />
          }
        </div>
        <div class="pie-registros">
          <button type="button" class="btn btn-secondary" [disabled]="registros().length >= max" (click)="agregar.emit()">
            <app-icon name="mas" [size]="16" [strokeWidth]="2.2" /> Agregar estudio
          </button>
          <span class="pie-registros__contador" [class.is-al-maximo]="registros().length >= max">
            {{ registros().length >= max ? 'Llegaste al máximo de ' + max : registros().length + ' de ' + max }}
          </span>
        </div>
      }
    </section>
  `,
})
export class HojaII {
  readonly registros = input<any[]>([]);
  readonly errors = input<any>({});
  readonly agregar = output<void>();
  readonly quitar = output<string>();
  readonly cambiar = output<{ id: string; patch: any }>();
  protected readonly max = MAX_REGISTROS;
  protected readonly lista = new ListaPlegable(() => this.registros());
}
