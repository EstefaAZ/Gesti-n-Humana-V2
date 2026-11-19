import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { anchoContenedor } from './ancho-contenedor';

const ALTO = 220;
const ALTO_LEYENDA = 32;
const RADIO_INTERNO = 55;
const RADIO_EXTERNO = 80;
const SEPARACION_GRADOS = 2;

export interface SegmentoDona {
  name: string;
  value: number;
  color: string;
}

/** Gráfico de dona en SVG con leyenda y tooltip (reemplaza el <PieChart> de Recharts). */
@Component({
  selector: 'app-grafico-dona',
  host: { style: 'display: contents' },
  template: `
    <div #contenedor style="width: 100%; height: 220px; position: relative">
      @if (ancho() > 0) {
        <svg [attr.width]="ancho()" [attr.height]="alto - altoLeyenda" style="display: block" role="img" [attr.aria-label]="resumen()">
          @for (s of segmentos(); track s.name; let i = $index) {
            <path
              [attr.d]="arco(i)"
              [attr.fill]="s.color"
              stroke="#fff"
              (mouseenter)="hover.set(i)"
              (mouseleave)="hover.set(null)"
            />
          }
        </svg>
        <ul class="grafico-leyenda">
          @for (s of segmentos(); track s.name) {
            <li>
              <svg width="14" height="14" style="vertical-align: middle; margin-right: 4px" aria-hidden="true"><rect width="14" height="14" [attr.fill]="s.color" /></svg>
              <span class="grafico-texto">{{ s.name }}</span>
            </li>
          }
        </ul>
        @if (hover() !== null) {
          <div class="grafico-tooltip" [style.left.px]="ancho() / 2 + 20" [style.top.px]="20">
            <span class="grafico-texto">{{ segmentos()[hover()!].name }} : {{ segmentos()[hover()!].value }}</span>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .grafico-leyenda {
      list-style: none;
      margin: 0;
      padding: 0;
      text-align: center;
      font-size: 14px;
      line-height: 1.6;
    }
    .grafico-leyenda li {
      display: inline-block;
      margin-right: 10px;
    }
    .grafico-tooltip {
      position: absolute;
      pointer-events: none;
      background: #fff;
      border: 1px solid #ccc;
      padding: 10px;
      font-size: 14px;
      white-space: nowrap;
    }
  `,
})
export class GraficoDona {
  readonly segmentos = input<SegmentoDona[]>([]);

  protected readonly alto = ALTO;
  protected readonly altoLeyenda = ALTO_LEYENDA;
  protected readonly hover = signal<number | null>(null);
  private readonly contenedor = viewChild<ElementRef<HTMLElement>>('contenedor');
  protected readonly ancho = anchoContenedor(() => this.contenedor());

  protected resumen(): string {
    return 'Vacantes por estado: ' + this.segmentos().map((s) => `${s.name} ${s.value}`).join(', ');
  }

  /** Igual que Recharts: arranca a las 3 en punto y avanza en sentido antihorario. */
  protected arco(i: number): string {
    const segs = this.segmentos();
    const total = segs.reduce((a, s) => a + s.value, 0) || 1;
    const n = segs.length;
    const disponible = 360 - (n > 1 ? SEPARACION_GRADOS * n : 0);
    let inicio = 0;
    for (let k = 0; k < i; k++) inicio += (segs[k].value / total) * disponible + (n > 1 ? SEPARACION_GRADOS : 0);
    const barrido = Math.min((segs[i].value / total) * disponible, 359.999);
    const cx = this.ancho() / 2;
    const cy = (ALTO - ALTO_LEYENDA) / 2;
    const punto = (r: number, grados: number) => {
      const rad = (-grados * Math.PI) / 180;
      return `${cx + r * Math.cos(rad)},${cy + r * Math.sin(rad)}`;
    };
    const fin = inicio + barrido;
    const grande = barrido > 180 ? 1 : 0;
    return [
      `M${punto(RADIO_EXTERNO, inicio)}`,
      `A${RADIO_EXTERNO},${RADIO_EXTERNO} 0 ${grande} 0 ${punto(RADIO_EXTERNO, fin)}`,
      `L${punto(RADIO_INTERNO, fin)}`,
      `A${RADIO_INTERNO},${RADIO_INTERNO} 0 ${grande} 1 ${punto(RADIO_INTERNO, inicio)}`,
      'Z',
    ].join(' ');
  }
}
