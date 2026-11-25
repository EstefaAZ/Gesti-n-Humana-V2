import { AfterViewInit, Component, ElementRef, OnChanges, OnDestroy, SimpleChanges, inject, input, output, signal, viewChild } from '@angular/core';
import { EstadoPostulacionBadge } from '../../components/estado-postulacion-badge';
import { Icon } from '../../shared/icon';
import { BotonDescargarTodos } from '../../components/boton-descargar-todos';
import { AuthService } from '../../core/auth.service';
import { TIPO_REGISTRO_LABELS, categoriasLicenciaDe, detalleRegistroII } from '../../data/catalogos';
import * as authApi from '../../lib/api/authApi';
import * as solicitudesApi from '../../lib/api/solicitudesApi';
import { CATEGORIAS_DOCUMENTOS, documentoActivo, textoPlazo } from '../../lib/api/solicitudesApi';
import { formatearFecha } from '../../lib/formato';

// Estados que Gestión Humana puede asignar, con una ayuda corta de qué significa cada uno.
const ESTADOS = [
  { valor: 'Recibida', clase: 'recibida', ayuda: 'La solicitud llegó y aún no se revisa.' },
  { valor: 'En revisión', clase: 'revision', ayuda: 'Gestión Humana está revisando el perfil.' },
  { valor: 'Preseleccionado', clase: 'preseleccionado', ayuda: 'Pasa a la siguiente etapa. Tendrá 3 días hábiles para adjuntar sus certificados laborales y de estudio.' },
  { valor: 'Entrevista programada', clase: 'entrevista', ayuda: 'Se citó al candidato a entrevista.' },
  { valor: 'Aceptada', clase: 'aceptada', ayuda: 'Fue seleccionado para el cargo.' },
  { valor: 'Rechazada', clase: 'rechazada', ayuda: 'No continúa en el proceso.' },
];

const CRITERIOS = [
  { clave: 'estudios', nombre: 'Estudios' },
  { clave: 'experiencia', nombre: 'Experiencia' },
  { clave: 'conocimientos', nombre: 'Conocimientos complementarios' },
];

/**
 * Resumen de una postulación para Gestión Humana, en un panel lateral sobre la
 * tabla de candidatos (antes era una tarjeta al final de la página). Se cierra
 * con la X, con Escape o con clic fuera del panel.
 */
@Component({
  selector: 'app-postulacion-detalle',
  imports: [EstadoPostulacionBadge, Icon, BotonDescargarTodos],
  host: { style: 'display: contents' },
  template: `
    <div class="pd-fondo" (click)="cerrar.emit()" aria-hidden="true"></div>
    <aside class="pd-panel" role="dialog" aria-modal="true" aria-labelledby="pd-nombre" (keydown.escape)="cerrar.emit()">
      <header class="pd-cabecera">
        <div class="pd-cabecera__fila">
          <span class="pd-avatar" aria-hidden="true">
            @if (fotoUrl()) {
              <img [src]="fotoUrl()" alt="" />
            } @else {
              {{ iniciales() }}
            }
          </span>
          <div class="pd-cabecera__texto">
            <h2 class="pd-nombre" id="pd-nombre">{{ dp().nombreCompleto || 'Aspirante' }}</h2>
            <p class="pd-sub">
              @if (dp().cedula) {
                <span>C.C. {{ dp().cedula }}</span>
              }
              @if (dp().profesion) {
                <span>{{ dp().profesion }}</span>
              }
            </p>
          </div>
          <button #botonCerrar type="button" class="pd-cerrar" aria-label="Cerrar resumen" (click)="cerrar.emit()">
            <app-icon name="cerrar" [size]="18" [strokeWidth]="2.2" />
          </button>
        </div>
        <div class="pd-cabecera__meta">
          <app-estado-postulacion-badge [estado]="estado()" />
          <span>Radicado <span class="pd-mono">{{ solicitud().radicado }}</span></span>
          @if (solicitud().fechaSolicitud) {
            <span>Recibida {{ fechaHora(solicitud().fechaSolicitud) }}</span>
          }
        </div>
        <div class="pd-cabecera__acciones">
          <button type="button" class="btn btn-secondary btn-sm" (click)="descargarPdf()">
            <app-icon name="descargar" [size]="14" [strokeWidth]="2" /> Descargar solicitud (PDF)
          </button>
          @if (dp().correo) {
            <a class="btn btn-secondary btn-sm" [href]="'mailto:' + dp().correo"><app-icon name="mail" [size]="14" [strokeWidth]="2" /> Escribir correo</a>
          }
        </div>
      </header>

      <div class="pd-cuerpo">
        <!-- Evaluación automática -->
        <section class="pd-bloque">
          <h3 class="pd-titulo">Evaluación automática</h3>
          @if (solicitud().evaluacion; as ev) {
            <div class="pd-veredicto" [class.pd-veredicto--ok]="ev.cumple" [class.pd-veredicto--no]="!ev.cumple">
              <app-icon [name]="ev.cumple ? 'check' : 'circle'" [size]="18" [strokeWidth]="2.4" />
              <div>
                <strong>{{ ev.cumple ? 'Cumple todos los criterios' : 'No cumple ' + ev.motivos.length + (ev.motivos.length === 1 ? ' criterio' : ' criterios') }}</strong>
                <span>La evaluación solo prioriza; la decisión es de Gestión Humana.</span>
              </div>
            </div>
            <ul class="pd-criterios">
              @for (c of criterios; track c.clave) {
                @if (ev.detalle?.[c.clave]; as d) {
                  <li class="pd-criterio">
                    <span class="pd-criterio__marca"
                      [class.is-ok]="d.cumple === true" [class.is-no]="d.cumple === false" [class.is-na]="d.cumple === null || d.cumple === undefined"
                      aria-hidden="true">{{ d.cumple === true ? '✓' : d.cumple === false ? '✕' : '–' }}</span>
                    <div>
                      <span class="pd-criterio__nombre">{{ c.nombre }}</span>
                      <span class="pd-criterio__detalle">
                        {{ d.cumple === true ? 'Cumple' : d.cumple === false ? (d.motivo || 'No cumple') : 'Sin requisito configurado' }}
                      </span>
                      @if (d.aviso) {
                        <span class="pd-criterio__aviso"><app-icon name="bell" [size]="13" [strokeWidth]="2" />{{ d.aviso }}</span>
                      }
                    </div>
                  </li>
                }
              }
            </ul>
          } @else {
            <p class="pd-vacio">Esta postulación no tiene evaluación automática.</p>
          }
        </section>

        <!-- Estado -->
        <section class="pd-bloque formulario-app">
          <h3 class="pd-titulo">Estado de la postulación</h3>
          @if (estado() === 'Retirada') {
            <p class="pd-alerta" style="margin: 0">El candidato se retiró de este proceso; su estado ya no se puede cambiar.</p>
          } @else {
            <div class="field">
              <label for="pd-nuevo-estado">Cambiar estado</label>
              <select id="pd-nuevo-estado" [value]="nuevoEstado()" (change)="nuevoEstado.set($any($event.target).value)" [disabled]="guardando()">
                @for (e of estados; track e.valor) {
                  <option [value]="e.valor" [selected]="nuevoEstado() === e.valor">{{ e.valor }}{{ estado() === e.valor ? ' (actual)' : '' }}</option>
                }
              </select>
              <span class="hint">{{ ayudaDe(nuevoEstado()) }}</span>
            </div>
            @if (nuevoEstado() !== estado()) {
              <div class="pd-confirmar" role="status">
                <p>
                  Cambiar de <strong>{{ estado() }}</strong> a <strong>{{ nuevoEstado() }}</strong>.
                  <span>El candidato recibirá una notificación y un correo.</span>
                </p>
                <div class="pd-confirmar__botones">
                  <button type="button" class="btn btn-secondary btn-sm" (click)="nuevoEstado.set(estado())" [disabled]="guardando()">Cancelar</button>
                  <button type="button" class="btn btn-primary btn-sm" (click)="guardarEstado()" [disabled]="guardando()">
                    {{ guardando() ? 'Guardando…' : 'Confirmar cambio' }}
                  </button>
                </div>
              </div>
            }
          }
          @if (historial().length > 0) {
            <ol class="pd-historial" aria-label="Historial de estados">
              @for (h of historial(); track $index) {
                <li>
                  <span class="pd-historial__estado">{{ h.estado }}</span>
                  <span class="pd-historial__fecha">{{ fechaHora(h.fecha) }}</span>
                </li>
              }
            </ol>
          }
        </section>

        <!-- Contacto -->
        <section class="pd-bloque">
          <h3 class="pd-titulo">Contacto y datos personales</h3>
          <dl class="pd-datos">
            <div><dt>Correo</dt><dd>{{ dp().correo || '—' }}</dd></div>
            <div><dt>Celular</dt><dd>{{ dp().celular || '—' }}</dd></div>
            <div class="pd-datos__ancho"><dt>Residencia</dt><dd>{{ residencia() }}</dd></div>
            <div><dt>Estado civil</dt><dd>{{ dp().estadoCivil || '—' }}</dd></div>
            <div><dt>Fecha de nacimiento</dt><dd>{{ fecha(dp().fechaNacimiento) || '—' }}</dd></div>
            <div><dt>Profesión</dt><dd>{{ dp().profesion || '—' }}</dd></div>
            <div><dt>Tarjeta profesional</dt><dd>{{ dp().tarjetaProfesional || '—' }}</dd></div>
            <div><dt>Licencia de conducción</dt><dd>{{ licencia() }}</dd></div>
          </dl>
        </section>

        <!-- Estudios -->
        <section class="pd-bloque">
          <h3 class="pd-titulo">Estudios, cursos e idiomas <span class="pd-contador">{{ (solicitud().registrosII || []).length }}</span></h3>
          @if ((solicitud().registrosII || []).length === 0) {
            <p class="pd-vacio">No registró estudios.</p>
          } @else {
            <ul class="pd-lista">
              @for (r of solicitud().registrosII; track $index) {
                <li class="pd-item">
                  <span class="pd-item__icono" aria-hidden="true"><app-icon [name]="r.tipo === 'certificacion' ? 'documento' : 'birrete'" [size]="16" [strokeWidth]="1.9" /></span>
                  <div class="pd-item__texto">
                    <span class="pd-item__titulo">{{ detalle(r) }}</span>
                    <span class="pd-item__sub">
                      {{ tipoRegistro(r) }}@if (r.nivelEducativo) { · {{ r.nivelEducativo }}}@if (r.graduado) { · {{ r.graduado === 'si' ? 'Graduado' : 'Sin graduar' }}}
                    </span>
                    @if (r.establecimiento || r.enteCertificador) {
                      <span class="pd-item__sub">{{ r.establecimiento || r.enteCertificador }}</span>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </section>

        <!-- Experiencia -->
        <section class="pd-bloque">
          <h3 class="pd-titulo">Experiencia laboral <span class="pd-contador">{{ (solicitud().experiencia || []).length }}</span></h3>
          @if ((solicitud().experiencia || []).length === 0) {
            <p class="pd-vacio">No registró experiencia laboral.</p>
          } @else {
            <ul class="pd-lista">
              @for (e of solicitud().experiencia; track $index) {
                <li class="pd-item">
                  <span class="pd-item__icono" aria-hidden="true"><app-icon name="briefcase" [size]="16" [strokeWidth]="1.9" /></span>
                  <div class="pd-item__texto">
                    <span class="pd-item__titulo">{{ e.cargo || 'Cargo sin especificar' }}</span>
                    <span class="pd-item__sub">{{ e.empresa || '—' }}@if (e.ciudad) { · {{ e.ciudad }}}</span>
                    <span class="pd-item__sub">
                      {{ fecha(e.fechaInicio) || '—' }} – {{ e.actual ? 'Actualidad' : fecha(e.fechaTerminacion) || '—' }}
                      @if (e.tiempoLaborado && e.tiempoLaborado !== '—') { · {{ e.tiempoLaborado }}}
                      @if (e.dedicacion) { · {{ e.dedicacion }}}
                    </span>
                  </div>
                </li>
              }
            </ul>
          }
        </section>

        <!-- Conflicto de interés -->
        <section class="pd-bloque">
          <h3 class="pd-titulo">Conflicto de interés</h3>
          @if (solicitud().conflicto?.tieneVinculo === 'si' && (solicitud().conflicto?.familiares || []).length > 0) {
            <p class="pd-alerta">Declaró vínculo con empleados o directivos:</p>
            <ul class="pd-lista">
              @for (f of solicitud().conflicto.familiares; track $index) {
                <li class="pd-item">
                  <span class="pd-item__icono" aria-hidden="true"><app-icon name="users" [size]="16" [strokeWidth]="1.9" /></span>
                  <div class="pd-item__texto">
                    <span class="pd-item__titulo">{{ f.nombreEmpleado || '—' }}</span>
                    <span class="pd-item__sub">{{ f.parentesco || '—' }} · {{ f.cargo || '—' }}</span>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="pd-vacio">No declaró vínculos con empleados o directivos.</p>
          }
          @if (solicitud().conflicto?.tieneOtraInhabilidad === 'si') {
            <p class="pd-alerta" style="margin-top: 10px">Otra inhabilidad o conflicto: {{ solicitud().conflicto?.descripcionInhabilidad || 'sin descripción' }}</p>
          }
        </section>

        <!-- Documentos -->
        <section class="pd-bloque">
          <div class="pd-titulo-fila">
            <h3 class="pd-titulo">Documentos adjuntos <span class="pd-contador">{{ totalArchivos() }}</span></h3>
            @if (totalArchivos() > 0) {
              <app-boton-descargar-todos [descargar]="descargarTodos" etiqueta="Descargar todos" />
            }
          </div>
          @if (certificados(); as cert) {
            <div class="pd-cert pd-cert--{{ cert.estado }}" role="status">
              <div>
                <strong>Certificados laborales y de estudio: {{ etiquetaCertificados[cert.estado] }}</strong>
                <span>
                  @switch (cert.estado) {
                    @case ('pendientes') { Tiene hasta el {{ plazo(cert.plazo) }} para adjuntarlos. }
                    @case ('recibidos') { Enviados el {{ fechaHora(cert.enviadosEn) }}. }
                    @case ('vencidos') { El plazo venció el {{ plazo(cert.plazo) }} sin que los adjuntara. }
                  }
                  @if (cert.ampliaciones > 0) { (Plazo ampliado {{ cert.ampliaciones }} {{ cert.ampliaciones === 1 ? 'vez' : 'veces' }}.) }
                </span>
              </div>
              @if (cert.estado !== 'recibidos') {
                <button type="button" class="btn btn-secondary btn-sm" (click)="ampliarPlazo()" [disabled]="ampliando()">
                  {{ ampliando() ? 'Ampliando…' : 'Dar 3 días hábiles más' }}
                </button>
              }
            </div>
          }
          <div class="pd-docs">
            @for (cat of categorias(); track cat.clave) {
              <div>
                <p class="pd-docs__categoria">{{ cat.etiqueta }}</p>
                @if (archivos(cat.clave).length === 0) {
                  <p class="pd-vacio pd-vacio--falta">Sin adjuntar</p>
                } @else {
                  <ul class="archivos-lista">
                    @for (doc of archivos(cat.clave); track $index; let i = $index) {
                      <li class="archivo-item">
                        <span class="archivo-item__icono" aria-hidden="true"><app-icon name="documento" [size]="16" [strokeWidth]="1.8" /></span>
                        <span class="archivo-item__texto"><span class="archivo-item__nombre" [title]="doc.nombre">{{ doc.nombre }}</span></span>
                        <button type="button" class="hr-link-btn" [attr.aria-label]="'Descargar ' + doc.nombre" (click)="descargarAdjunto(cat.claveApi, i, doc.nombre)">
                          <app-icon name="descargar" [size]="16" [strokeWidth]="2" />
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>
            }
          </div>
        </section>

        <!-- Autorización -->
        <section class="pd-bloque">
          <h3 class="pd-titulo">Autorización de datos</h3>
          @if (solicitud().autorizacion?.acepta) {
            <div class="pd-veredicto pd-veredicto--ok">
              <app-icon name="check" [size]="18" [strokeWidth]="2.4" />
              <div>
                <strong>Autorización concedida</strong>
                <span>Firmada por {{ solicitud().autorizacion?.nombreCompleto || 'el candidato' }}{{ solicitud().fechaSolicitud ? ' · ' + fechaHora(solicitud().fechaSolicitud) : '' }}</span>
              </div>
            </div>
          } @else {
            <p class="pd-vacio">No hay registro de autorización para esta solicitud.</p>
          }
        </section>
      </div>
    </aside>
  `,
})
export class PostulacionDetalle implements OnChanges, AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  readonly solicitud = input.required<any>();
  readonly cerrar = output<void>();
  readonly cambioEstado = output<void>();

  private readonly botonCerrar = viewChild<ElementRef<HTMLButtonElement>>('botonCerrar');
  private focoAnterior: HTMLElement | null = null;

  protected readonly estados = ESTADOS;
  protected readonly criterios = CRITERIOS;
  // Los tipos que ya no se piden solo aparecen si la postulación los trae.
  protected categorias() {
    const docs = this.solicitud().documentosAdjuntos || {};
    return CATEGORIAS_DOCUMENTOS.filter((c) => documentoActivo(c.clave) || (docs[c.clave] || []).length > 0);
  }
  protected readonly fecha = formatearFecha;
  protected readonly detalle = detalleRegistroII;
  protected readonly estado = signal('');
  protected readonly nuevoEstado = signal('');
  protected readonly guardando = signal(false);
  protected readonly historial = signal<{ estado: string; fecha: string }[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    const ch = changes['solicitud'];
    if (ch && (ch.firstChange || ch.previousValue?.radicado !== ch.currentValue?.radicado)) {
      this.estado.set(this.solicitud().estado);
      this.nuevoEstado.set(this.solicitud().estado);
      this.historial.set([...(this.solicitud().historialEstados || [])].reverse());
      this.certificados.set(this.solicitud().certificados);
      this.cargarFoto(this.solicitud().usuarioId);
    }
  }

  /** Foto de perfil del candidato; si no tiene o falla, quedan las iniciales. */
  protected readonly fotoUrl = signal<string | null>(null);
  private consultaFoto = 0;

  private async cargarFoto(usuarioId: string | undefined): Promise<void> {
    const consulta = ++this.consultaFoto;
    this.liberarFoto();
    if (!usuarioId) return;
    try {
      const blob = await authApi.obtenerFotoDeUsuario(usuarioId, this.auth.token());
      // Si mientras tanto se abrió otra postulación (o se cerró el panel), se descarta.
      if (blob && consulta === this.consultaFoto) this.fotoUrl.set(URL.createObjectURL(blob));
    } catch {
      // Sin foto: se muestran las iniciales.
    }
  }

  private liberarFoto(): void {
    const url = this.fotoUrl();
    if (url) URL.revokeObjectURL(url);
    this.fotoUrl.set(null);
  }

  ngAfterViewInit(): void {
    // Mientras el panel está abierto la página de fondo no se desplaza, y el foco
    // entra al panel (vuelve al botón "Ver detalles" al cerrarlo).
    this.focoAnterior = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    this.botonCerrar()?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.consultaFoto++;
    this.liberarFoto();
    document.body.style.overflow = '';
    this.focoAnterior?.focus?.();
  }

  protected ayudaDe(valor: string): string {
    return ESTADOS.find((e) => e.valor === valor)?.ayuda || '';
  }

  protected dp(): any {
    return this.solicitud().datosPersonales || {};
  }

  protected licencia(): string {
    if (this.dp().licencia !== 'si') return 'No tiene';
    const categorias = categoriasLicenciaDe(this.dp());
    return categorias.length ? `Sí · ${categorias.join(', ')}` : 'Sí';
  }

  protected iniciales(): string {
    const partes = String(this.dp().nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length > 2 ? 2 : 1][0] : '')).toUpperCase() || '?';
  }

  protected residencia(): string {
    const dp = this.dp();
    return [dp.direccion, dp.municipio, dp.deptoResidencia].filter(Boolean).join(', ') || '—';
  }

  protected tipoRegistro(r: any): string {
    return TIPO_REGISTRO_LABELS[r.tipo] || r.tipoLabel || 'Registro';
  }

  protected archivos(clave: string): any[] {
    return this.solicitud().documentosAdjuntos?.[clave] || [];
  }

  protected totalArchivos(): number {
    return this.categorias().reduce((total, c) => total + this.archivos(c.clave).length, 0);
  }

  protected fechaHora(valor: string | null | undefined): string {
    if (!valor) return '';
    const f = new Date(valor);
    if (Number.isNaN(f.getTime())) return '';
    return f.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected descargarPdf(): void {
    solicitudesApi.descargarPdf(this.solicitud().radicado, this.auth.token());
  }

  protected readonly descargarTodos = () =>
    solicitudesApi.descargarDocumentosZip(
      this.solicitud().radicado,
      `${this.solicitud().radicado} - ${this.dp().nombreCompleto || 'candidato'}.zip`,
      this.auth.token(),
    );

  protected descargarAdjunto(categoriaApi: string, indice: number, nombre: string): void {
    solicitudesApi.descargarDocumentoAdjunto(this.solicitud().radicado, categoriaApi, indice, nombre, this.auth.token());
  }

  // ---- Certificados (se piden al preseleccionar) ----
  protected readonly certificados = signal<any>(null);
  protected readonly ampliando = signal(false);
  protected readonly etiquetaCertificados: Record<string, string> = { pendientes: 'pendientes', recibidos: 'recibidos', vencidos: 'plazo vencido' };
  protected readonly plazo = textoPlazo;

  protected async ampliarPlazo(): Promise<void> {
    this.ampliando.set(true);
    try {
      const actualizada = await solicitudesApi.ampliarPlazoCertificados(this.solicitud().radicado, this.auth.token());
      this.certificados.set(actualizada.certificados);
      this.cambioEstado.emit();
    } catch {
      alert('No se pudo ampliar el plazo.');
    } finally {
      this.ampliando.set(false);
    }
  }

  protected async guardarEstado(): Promise<void> {
    this.guardando.set(true);
    try {
      const actualizada = await solicitudesApi.cambiarEstado(this.solicitud().radicado, this.nuevoEstado(), this.auth.token());
      this.estado.set(actualizada.estado);
      this.historial.set([...(actualizada.historialEstados || [])].reverse());
      this.certificados.set(actualizada.certificados);
      this.cambioEstado.emit();
    } catch {
      alert('No se pudo actualizar el estado.');
    } finally {
      this.guardando.set(false);
    }
  }
}
