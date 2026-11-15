import { DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';

/** Ancho del contenedor (equivalente a <ResponsiveContainer width="100%"> de Recharts). */
export function anchoContenedor(el: () => ElementRef<HTMLElement> | undefined) {
  const ancho = signal(0);
  const destroyRef = inject(DestroyRef);
  afterNextRender(() => {
    const nodo = el()?.nativeElement;
    if (!nodo) return;
    ancho.set(nodo.clientWidth);
    const ro = new ResizeObserver(() => ancho.set(nodo.clientWidth));
    ro.observe(nodo);
    destroyRef.onDestroy(() => ro.disconnect());
  });
  return ancho;
}

/** Marcas "bonitas" del eje Y (enteros, 5 marcas), como allowDecimals={false}. */
export function marcasEnteras(max: number, cantidad = 5): number[] {
  const intervalos = cantidad - 1;
  let paso = 1;
  if (max > intervalos) {
    const pasoBruto = max / intervalos;
    const magnitud = Math.pow(10, Math.floor(Math.log10(pasoBruto)));
    const opciones = [1, 2, 2.5, 5, 10].map((m) => m * magnitud);
    paso = Math.max(1, Math.ceil(opciones.find((o) => o >= pasoBruto) || pasoBruto));
  }
  return Array.from({ length: cantidad }, (_, k) => k * paso);
}
