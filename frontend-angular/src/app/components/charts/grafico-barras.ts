import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { anchoContenedor, marcasEnteras } from './ancho-contenedor';

const ALTO = 220;
const MARGEN = { top: 5, right: 5, bottom: 5, left: 5 };
const ANCHO_EJE_Y = 60;
const ALTO_EJE_X = 30;

/** Gráfico de barras sencillo en SVG (reemplaza el <BarChart> de Recharts). */
@Component({
  selector: 'app-grafico-barras',
  host: { style: 'display: contents' },
  template: `
    <div #contenedor style="width: 100%; height: 220px; position: relative">
      @if (ancho() > 0) {
        <svg [attr.width]="ancho()" [attr.height]="alto" style="display: block" role="img" [attr.aria-label]="resumen()">
          <!-- Eje Y -->
          <line [attr.x1]="x0()" [attr.x2]="x0()" [attr.y1]="MARGEN.top" [attr.y2]="y0()" [attr.stroke]="color()" />
          @for (m of marcas(); track m) {
            <line [attr.x1]="x0() - 6" [attr.x2]="x0()" [attr.y1]="y(m)" [attr.y2]="y(m)" [attr.stroke]="color()" />
            <text [attr.x]="x0() - 8" [attr.y]="y(m)" text-anchor="end" dominant-baseline="central" font-size="12" [attr.fill]="color()">{{ m }}</text>
          }
          <!-- Eje X -->
          <line [attr.x1]="x0()" [attr.x2]="xFin()" [attr.y1]="y0()" [attr.y2]="y0()" [attr.stroke]="color()" />
          @for (d of datos(); track $index; let i = $index) {
            @if (hover() === i) {
              <rect [attr.x]="x0() + i * banda()" [attr.y]="MARGEN.top" [attr.width]="banda()" [attr.height]="y0() - MARGEN.top" fill="#EDF8EF" />
            }
            <path [attr.d]="barra(i, d[valor()])" [attr.fill]="relleno()" />
            <line [attr.x1]="centro(i)" [attr.x2]="centro(i)" [attr.y1]="y0()" [attr.y2]="y0() + 6" [attr.stroke]="color()" />
            <text [attr.x]="centro(i)" [attr.y]="y0() + 18" text-anchor="middle" font-size="12" [attr.fill]="color()">{{ d[etiqueta()] }}</text>
            <rect
              [attr.x]="x0() + i * banda()"
              [attr.y]="MARGEN.top"
              [attr.width]="banda()"
              [attr.height]="y0() - MARGEN.top"
              fill="transparent"
              (mouseenter)="hover.set(i)"
              (mouseleave)="hover.set(null)"
            />
          }
        </svg>
        @if (hover() !== null) {
          <div class="grafico-tooltip" [style.left.px]="centro(hover()!) + 12" [style.top.px]="40">
            <div class="grafico-tooltip__titulo">{{ datos()[hover()!][etiqueta()] }}</div>
            <div class="grafico-texto"><strong>{{ datos()[hover()!][valor()] }}</strong> {{ unidad() || valor() }}</div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .grafico-tooltip {
      position: absolute;
      pointer-events: none;
      background: #fff;
      border: 1px solid var(--color-border-strong);
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0, 40, 16, 0.12);
      padding: 8px 12px;
      font-size: 13px;
      white-space: nowrap;
    }
    .grafico-tooltip__titulo {
      font-size: 11.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--color-text-muted);
    }
  `,
})
export class GraficoBarras {
  readonly datos = input<any[]>([]);
  readonly etiqueta = input<string>('mes');
  readonly valor = input<string>('total');
  readonly relleno = input<string>('#2EA04A');
  readonly color = input<string>('#5B6B60');
  /** Texto tras el número en el tooltip (ej. "postulaciones"). */
  readonly unidad = input<string>('');

  protected readonly MARGEN = MARGEN;
  protected readonly alto = ALTO;
  protected readonly hover = signal<number | null>(null);
  private readonly contenedor = viewChild<ElementRef<HTMLElement>>('contenedor');
  protected readonly ancho = anchoContenedor(() => this.contenedor());

  protected resumen(): string {
    return 'Postulaciones por mes: ' + this.datos().map((d) => `${d[this.etiqueta()]} ${d[this.valor()]}`).join(', ');
  }

  protected x0(): number {
    return MARGEN.left + ANCHO_EJE_Y;
  }
  protected xFin(): number {
    return this.ancho() - MARGEN.right;
  }
  protected y0(): number {
    return ALTO - MARGEN.bottom - ALTO_EJE_X;
  }
  protected marcas(): number[] {
    const max = Math.max(0, ...this.datos().map((d) => Number(d[this.valor()]) || 0));
    return marcasEnteras(max);
  }
  protected y(v: number): number {
    const marcas = this.marcas();
    const max = marcas[marcas.length - 1] || 1;
    return this.y0() - (v / max) * (this.y0() - MARGEN.top);
  }
  protected banda(): number {
    return (this.xFin() - this.x0()) / Math.max(1, this.datos().length);
  }
  protected centro(i: number): number {
    return this.x0() + i * this.banda() + this.banda() / 2;
  }
  /** Barra con las esquinas superiores redondeadas (radius={[4, 4, 0, 0]}). */
  protected barra(i: number, valor: number): string {
    const ancho = this.banda() * 0.8;
    const x = this.x0() + i * this.banda() + this.banda() * 0.1;
    const yTop = this.y(Number(valor) || 0);
    const alto = this.y0() - yTop;
    if (alto <= 0) return '';
    const r = Math.min(4, alto, ancho / 2);
    return `M${x},${this.y0()} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + ancho - r},${yTop} Q${x + ancho},${yTop} ${x + ancho},${yTop + r} L${x + ancho},${this.y0()} Z`;
  }
}
