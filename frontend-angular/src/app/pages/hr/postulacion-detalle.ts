import { Component, OnChanges, SimpleChanges, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EvaluacionBadge } from '../../components/evaluacion-badge';
import { TablaSimple } from '../../components/tabla-simple';
import { AuthService } from '../../core/auth.service';
import { detalleRegistroII } from '../../data/catalogos';
import * as solicitudesApi from '../../lib/api/solicitudesApi';
import { CATEGORIAS_DOCUMENTOS } from '../../lib/api/solicitudesApi';

const ESTADOS = ['Recibida', 'En revisión', 'Preseleccionado', 'Entrevista programada', 'Rechazada', 'Aceptada'];

import { CampoAccesible } from '../../shared/campo-accesible';

@Component({
  selector: 'app-postulacion-detalle',
  imports: [CampoAccesible, FormsModule, EvaluacionBadge, TablaSimple],
  host: { style: 'display: contents' },
  template: `
    <div class="card mt-24">
      <div class="wizard-actions" style="margin-top: 0; padding-top: 0; border-top: none">
        <h2 class="section-title" style="margin: 0">{{ dp().nombreCompleto }}</h2>
        <div class="hr-table-actions">
          <button type="button" class="btn btn-secondary" (click)="descargarPdf()">Descargar PDF</button>
          <button type="button" class="hr-link-btn" (click)="cerrar.emit()">Cerrar</button>
        </div>
      </div>

      <p class="text-muted">Radicado: <strong>{{ solicitud().radicado }}</strong></p>

      <app-evaluacion-badge [evaluacion]="solicitud().evaluacion" />

      <div class="notice notice--info" style="margin-top: 16px">
        <strong>Estado actual: {{ estado() }}</strong>
        <div class="field-grid" style="margin-top: 10px">
          <div class="field">
            <select aria-label="Nuevo estado de la postulación" [ngModel]="nuevoEstado()" (ngModelChange)="nuevoEstado.set($event)">
              @for (e of estados; track e) {
                <option [value]="e">{{ e }}</option>
              }
            </select>
          </div>
          <div class="field">
            <button type="button" class="btn btn-secondary" (click)="guardarEstado()" [disabled]="guardando() || nuevoEstado() === estado()">
              {{ guardando() ? 'Guardando…' : 'Actualizar estado' }}
            </button>
          </div>
        </div>
      </div>

      <h3 class="section-title" style="font-size: 14px; margin-top: 20px">Datos personales</h3>
      <app-tabla-simple [filas]="filasDatosPersonales()" [campos]="['etiqueta', 'valor']" [labels]="['Etiqueta', 'Valor']" sinEncabezado />

      <h3 class="section-title" style="font-size: 14px">Estudios, cursos, certificaciones e idiomas</h3>
      <app-tabla-simple [filas]="filasRegistrosII()" [campos]="['tipo', 'detalle', 'establecimiento']" [labels]="['Tipo', 'Detalle', 'Establecimiento/Ente']" />

      <h3 class="section-title" style="font-size: 14px">Experiencia laboral</h3>
      <app-tabla-simple
        [filas]="solicitud().experiencia"
        [campos]="['empresa', 'cargo', 'tiempoLaborado', 'dedicacion']"
        [labels]="['Empresa', 'Cargo', 'Tiempo', 'Dedicación']"
      />

      <h3 class="section-title" style="font-size: 14px">Conflicto de interés</h3>
      @if (solicitud().conflicto?.tieneVinculo === 'si') {
        <app-tabla-simple
          [filas]="solicitud().conflicto.familiares"
          [campos]="['parentesco', 'nombreEmpleado', 'cargo']"
          [labels]="['Parentesco', 'Nombre', 'Cargo']"
        />
      } @else {
        <p class="text-muted" style="font-size: 12.5px">No declaró vínculos.</p>
      }

      <h3 class="section-title" style="font-size: 14px">Documentos adjuntos</h3>
      @for (cat of categorias; track cat.clave) {
        <div style="margin-bottom: 10px">
          <span style="font-size: 12.5px; font-weight: 600">{{ cat.etiqueta }}: </span>
          @if (archivos(cat.clave).length === 0) {
            <span class="text-muted" style="font-size: 12.5px">sin adjuntar</span>
          } @else {
            @for (doc of archivos(cat.clave); track $index; let i = $index) {
              <button type="button" class="hr-link-btn" style="margin-right: 10px" (click)="descargarAdjunto(cat.claveApi, i, doc.nombre)">
                📄 {{ doc.nombre }}
              </button>
            }
          }
        </div>
      }

      <h3 class="section-title" style="font-size: 14px">Autorización</h3>
      @if (solicitud().autorizacion?.acepta) {
        <p style="font-size: 13px">
          Autorización de tratamiento de datos <strong>concedida</strong> por {{ solicitud().autorizacion?.nombreCompleto || 'el candidato' }}
          — {{ fechaSolicitud() }}
        </p>
      } @else {
        <p style="font-size: 13px" class="text-muted">No hay registro de autorización para esta solicitud.</p>
      }
    </div>
  `,
})
export class PostulacionDetalle implements OnChanges {
  private readonly auth = inject(AuthService);
  readonly solicitud = input.required<any>();
  readonly cerrar = output<void>();
  readonly cambioEstado = output<void>();

  protected readonly estados = ESTADOS;
  protected readonly categorias = CATEGORIAS_DOCUMENTOS;
  protected readonly estado = signal('');
  protected readonly nuevoEstado = signal('');
  protected readonly guardando = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    const ch = changes['solicitud'];
    if (ch && (ch.firstChange || ch.previousValue?.radicado !== ch.currentValue?.radicado)) {
      this.estado.set(this.solicitud().estado);
      this.nuevoEstado.set(this.solicitud().estado);
    }
  }

  protected dp(): any {
    return this.solicitud().datosPersonales || {};
  }

  protected filasDatosPersonales(): any[] {
    const dp = this.dp();
    return [
      { etiqueta: 'Cédula', valor: dp.cedula },
      { etiqueta: 'Correo', valor: dp.correo },
      { etiqueta: 'Celular', valor: dp.celular },
      { etiqueta: 'Residencia', valor: `${dp.direccion}, ${dp.municipio}, ${dp.deptoResidencia}` },
      { etiqueta: 'Profesión', valor: dp.profesion || '—' },
      { etiqueta: 'Estado civil', valor: dp.estadoCivil },
    ];
  }

  protected filasRegistrosII(): any[] {
    return (this.solicitud().registrosII || []).map((r: any) => ({
      tipo: r.tipoLabel,
      detalle: detalleRegistroII(r),
      establecimiento: r.establecimiento || r.enteCertificador || '—',
    }));
  }

  protected archivos(clave: string): any[] {
    return this.solicitud().documentosAdjuntos?.[clave] || [];
  }

  protected fechaSolicitud(): string {
    return new Date(this.solicitud().fechaSolicitud).toLocaleString('es-CO');
  }

  protected descargarPdf(): void {
    solicitudesApi.descargarPdf(this.solicitud().radicado, this.auth.token());
  }

  protected descargarAdjunto(categoriaApi: string, indice: number, nombre: string): void {
    solicitudesApi.descargarDocumentoAdjunto(this.solicitud().radicado, categoriaApi, indice, nombre, this.auth.token());
  }

  protected async guardarEstado(): Promise<void> {
    this.guardando.set(true);
    try {
      const actualizada = await solicitudesApi.cambiarEstado(this.solicitud().radicado, this.nuevoEstado(), this.auth.token());
      this.estado.set(actualizada.estado);
      this.cambioEstado.emit();
    } catch {
      alert('No se pudo actualizar el estado.');
    } finally {
      this.guardando.set(false);
    }
  }
}
