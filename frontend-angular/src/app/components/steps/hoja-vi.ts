import { Component, input, output } from '@angular/core';
import { ExperienciaCard } from './experiencia-card';
import { Icon } from '../../shared/icon';
import { ListaPlegable } from './lista-plegable';
import { NotaObligatorios } from '../nota-obligatorios';

const MAX_EXPERIENCIAS = 10;

@Component({
  selector: 'app-hoja-vi',
  imports: [NotaObligatorios, ExperienciaCard, Icon],
  host: { style: 'display: contents' },
  template: `
    <section>
      <h2 class="section-title">Experiencia Laboral</h2>
      <p class="section-intro">
        Use el botón “Agregar experiencia” tantas veces como necesite para registrar todas sus experiencias
        (máximo 10). Durante el proceso de selección, Aguas Nacionales EPM S.A. E.S.P. solicitará certificación
        escrita, con descripción de funciones, de la empresa para la cual usted trabajó. Por eso, describa
        únicamente experiencias relacionadas con el cargo al que aspira y absténgase de describir cargos y
        funciones que no puedan ser certificadas. Si en una misma empresa ha laborado en varios cargos, regístrelos por separado.
      </p>
      <app-nota-obligatorios extra="Debe agregar al menos una experiencia laboral." />

      @if (errors()?.['experiencias']) {
        <div class="notice notice--danger" role="alert">{{ errors()['experiencias'] }}</div>
      }

      @if (experiencias().length === 0) {
        <div class="vacio">
          <span class="vacio__icono" aria-hidden="true"><app-icon name="briefcase" [size]="20" [strokeWidth]="1.8" /></span>
          <div class="vacio__texto">
            <p class="vacio__titulo">Todavía no hay experiencias</p>
            <p class="vacio__ayuda">Agrega cada cargo que hayas tenido; si fueron varios en la misma empresa, por separado. Puedes registrar hasta {{ max }}.</p>
          </div>
          <button type="button" class="btn btn-primary" (click)="agregar.emit()">
            <app-icon name="mas" [size]="16" [strokeWidth]="2.2" /> Agregar experiencia
          </button>
        </div>
      } @else {
        <div class="lista-registros">
          @for (exp of experiencias(); track exp.id; let i = $index) {
            <app-experiencia-card
              [experiencia]="exp"
              [index]="i"
              [abierto]="lista.abiertoId() === exp.id"
              (alternar)="lista.alternar(exp.id)"
              (listo)="lista.listo(exp.id)"
              (cambiar)="cambiar.emit($event)"
              (quitar)="quitar.emit($event)"
            />
          }
        </div>
        <div class="pie-registros">
          <button type="button" class="btn btn-secondary" [disabled]="experiencias().length >= max" (click)="agregar.emit()">
            <app-icon name="mas" [size]="16" [strokeWidth]="2.2" /> Agregar experiencia
          </button>
          <span class="pie-registros__contador" [class.is-al-maximo]="experiencias().length >= max">
            {{ experiencias().length >= max ? 'Llegaste al máximo de ' + max : experiencias().length + ' de ' + max }}
          </span>
        </div>
      }
    </section>
  `,
})
export class HojaVI {
  readonly experiencias = input<any[]>([]);
  readonly errors = input<any>({});
  readonly agregar = output<void>();
  readonly quitar = output<string>();
  readonly cambiar = output<{ id: string; patch: any }>();
  protected readonly max = MAX_EXPERIENCIAS;
  protected readonly lista = new ListaPlegable(() => this.experiencias());
}
