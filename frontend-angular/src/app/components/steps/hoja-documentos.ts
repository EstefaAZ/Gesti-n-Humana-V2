import { Component, input, output, signal } from '@angular/core';

import { Icon } from '../../shared/icon';
import { ZonaArchivos, pesoLegible, pesoDeBase64 } from '../zona-archivos';import { archivoABase64 } from '../../lib/formState';

const CATEGORIAS = [
  { clave: 'cedula', etiqueta: 'Cédula de ciudadanía', max: 1, ayuda: 'Copia legible de tu cédula.' },
  { clave: 'certificadosLaborales', etiqueta: 'Certificados laborales con funciones', max: 10, ayuda: 'Uno por cada empleo relevante, con funciones y fechas.' },
  { clave: 'certificadosEstudio', etiqueta: 'Certificados de estudio y/o cursos', max: 10, ayuda: 'Diplomas, actas de grado, certificados de cursos.' },
  { clave: 'tarjetaProfesional', etiqueta: 'Tarjeta profesional', max: 3, ayuda: 'Si tu profesión la requiere.' },
];

const MAX_TAMANO_MB = 5;

/** Recibe la función que transforma los documentos actuales en los nuevos (igual que el setState funcional de React). */
export type ActualizadorDocumentos = (prev: any) => any;

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  imports: [CampoAccesible, Icon, ZonaArchivos],
  selector: 'app-hoja-documentos',
  host: { style: 'display: contents' },
  template: `
    <section>
      <h2 class="section-title">Documentos obligatorios</h2>
      <p class="section-intro">
        Adjunta los siguientes documentos para poder enviar tu solicitud. Formatos aceptados: PDF o imagen, máximo {{ maxMb }} MB por archivo.
      </p>

      @for (cat of categorias; track cat.clave) {
        <div class="field" style="margin-bottom: 22px">
          <label>
            {{ cat.etiqueta }} * <span class="text-muted" style="font-weight: 400">({{ archivos(cat.clave).length }}/{{ cat.max }})</span>
          </label>
          <p class="text-muted" style="font-size: 12px; margin: 0 0 8px">{{ cat.ayuda }}</p>

          @if (errors()[cat.clave]) {
            <div class="notice notice--danger" style="margin-bottom: 8px">{{ errors()[cat.clave] }}</div>
          }

          @if (archivos(cat.clave).length > 0) {
            <ul class="archivos-lista">
              @for (doc of archivos(cat.clave); track $index; let i = $index) {
                <li class="archivo-item">
                  <span class="archivo-item__icono" aria-hidden="true"><app-icon name="documento" [size]="16" [strokeWidth]="1.8" /></span>
                  <span class="archivo-item__texto">
                    <span class="archivo-item__nombre" [title]="doc.nombre">{{ doc.nombre }}</span>
                    @if (peso(doc)) {<span class="archivo-item__detalle">{{ peso(doc) }}</span>}
                  </span>
                  <button type="button" class="hr-link-btn hr-link-btn--danger" [attr.aria-label]="'Quitar ' + doc.nombre" (click)="quitarArchivo(cat.clave, i)">Quitar</button>
                </li>
              }
            </ul>
          }

          @if (archivos(cat.clave).length < cat.max) {
            <app-zona-archivos
              accept="application/pdf,image/*"
              textoTipos="solo se aceptan PDF o imágenes"
              [multiple]="cat.max > 1"
              [disabled]="cargando() === cat.clave"
              [textoBoton]="cargando() === cat.clave ? 'Cargando…' : archivos(cat.clave).length > 0 ? 'Agregar otro' : 'Elegir archivo'"
              [etiqueta]="cat.etiqueta"
              (archivos)="agregarArchivos(cat.clave, cat.max, $event)"
            />
          }
        </div>
      }
    </section>
  `,
})
export class HojaDocumentos {
  readonly documentos = input.required<any>();
  readonly errors = input<any>({});
  readonly setDocumentos = output<ActualizadorDocumentos>();

  protected readonly categorias = CATEGORIAS;
  protected readonly maxMb = MAX_TAMANO_MB;
  protected readonly cargando = signal<string | null>(null); // clave de la categoría que está procesando un archivo

  protected archivos(clave: string): any[] {
    return this.documentos()[clave] || [];
  }

  protected peso(doc: any): string {
    return pesoLegible(pesoDeBase64(doc?.contenidoBase64));
  }

  protected async agregarArchivos(clave: string, max: number, fileList: File[]): Promise<void> {
    const actuales = this.documentos()[clave] || [];
    const espacioDisponible = max - actuales.length;
    if (espacioDisponible <= 0) return;

    const archivos = fileList.slice(0, espacioDisponible);
    const rechazadosPorTamano = archivos.filter((f) => f.size > MAX_TAMANO_MB * 1024 * 1024);
    if (rechazadosPorTamano.length > 0) {
      alert(`"${rechazadosPorTamano[0].name}" pesa más de ${MAX_TAMANO_MB} MB. Sube un archivo más liviano.`);
    }
    const validos = archivos.filter((f) => f.size <= MAX_TAMANO_MB * 1024 * 1024);
    if (validos.length === 0) return;

    this.cargando.set(clave);
    try {
      const nuevos = await Promise.all(validos.map(async (f) => ({ nombre: f.name, contenidoBase64: await archivoABase64(f) })));
      this.setDocumentos.emit((prev) => ({ ...prev, [clave]: [...(prev[clave] || []), ...nuevos] }));
    } finally {
      this.cargando.set(null);
    }
  }

  protected quitarArchivo(clave: string, indice: number): void {
    this.setDocumentos.emit((prev) => ({ ...prev, [clave]: prev[clave].filter((_: any, i: number) => i !== indice) }));
  }
}
