import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocHeader } from '../../components/doc-header';
import { TablaSimple } from '../../components/tabla-simple';
import { AuthService } from '../../core/auth.service';
import * as authApi from '../../lib/api/authApi';
import * as perfilesApi from '../../lib/api/perfilesApi';
import { detalleRegistroII } from '../../data/catalogos';
import { CATEGORIAS_DOCUMENTOS } from '../../lib/api/solicitudesApi';

function fechaCorta(fecha: string | null | undefined): string {
  return fecha ? new Date(fecha).toLocaleDateString('es-CO') : '—';
}

@Component({
  selector: 'app-candidatos-page',
  imports: [FormsModule, DocHeader, TablaSimple],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Candidatos" [showCode]="false" />
    @if (error()) {
      <main class="page"><div class="notice notice--danger">{{ error() }}</div></main>
    } @else if (!candidatos()) {
      <main class="page"><p class="text-muted">Cargando…</p></main>
    } @else if (seleccionado(); as cand) {
      <main class="page">
        <!-- Detalle del candidato -->
        <div class="card mt-24">
          <div class="wizard-actions" style="margin-top: 0; padding-top: 0; border-top: none">
            <h2 class="section-title" style="margin: 0">{{ cand.nombreCompleto }}</h2>
            <button type="button" class="hr-link-btn" (click)="seleccionado.set(null)">Cerrar</button>
          </div>
          <p class="text-muted">Correo: {{ cand.email }} · Registrado: {{ fechaCorta(cand.fechaCreacion) }}</p>

          @if (perfilesPorId()[cand.id]; as perfil) {
            <h3 class="section-title" style="font-size: 14px; margin-top: 16px">Datos personales</h3>
            <app-tabla-simple [filas]="filasDatosPersonales(perfil)" [campos]="['etiqueta', 'valor']" [labels]="['Etiqueta', 'Valor']" sinEncabezado />

            <h3 class="section-title" style="font-size: 14px">Estudios, cursos, certificaciones e idiomas</h3>
            <app-tabla-simple
              [filas]="filasRegistrosII(perfil)"
              [campos]="['tipo', 'detalle', 'establecimiento']"
              [labels]="['Tipo', 'Detalle', 'Establecimiento/Ente']"
            />

            <h3 class="section-title" style="font-size: 14px">Experiencia laboral</h3>
            <app-tabla-simple
              [filas]="perfil.experiencia"
              [campos]="['empresa', 'cargo', 'tiempoLaborado', 'dedicacion']"
              [labels]="['Empresa', 'Cargo', 'Tiempo', 'Dedicación']"
            />

            <h3 class="section-title" style="font-size: 14px">Documentos del perfil</h3>
            @for (cat of categorias; track cat.clave) {
              <div style="margin-bottom: 10px">
                <span style="font-size: 12.5px; font-weight: 600">{{ cat.etiqueta }}: </span>
                @if ((perfil.documentosAdjuntos?.[cat.clave] || []).length === 0) {
                  <span class="text-muted" style="font-size: 12.5px">sin adjuntar</span>
                } @else {
                  @for (doc of perfil.documentosAdjuntos[cat.clave]; track $index; let i = $index) {
                    <button type="button" class="hr-link-btn" style="margin-right: 10px" (click)="descargar(cand.id, cat.claveApi, i, doc.nombre)">
                      📄 {{ doc.nombre }}
                    </button>
                  }
                }
              </div>
            }
          } @else {
            <div class="notice notice--warning">Este candidato todavía no ha completado su perfil.</div>
          }
        </div>
      </main>
    } @else {
      <main class="page">
        <div class="card">
          <div class="hr-table-actions" style="margin-bottom: 16px">
            <input
              type="search"
              aria-label="Buscar candidatos"
              autocomplete="off"
              placeholder="Buscar por nombre o cédula…"
              [value]="busqueda()"
              (input)="busqueda.set($any($event.target).value)"
              style="max-width: 280px"
            />
            <select aria-label="Filtrar por estado del perfil" [ngModel]="filtroPerfil()" (ngModelChange)="filtroPerfil.set($event)" style="max-width: 200px">
              <option value="todos">Todos los candidatos</option>
              <option value="completo">Perfil completo</option>
              <option value="incompleto">Perfil incompleto</option>
            </select>
          </div>

          @if (filtrados().length === 0) {
            <div class="empty-state">Ningún candidato coincide con el filtro.</div>
          } @else {
            <table class="plain-table">
              <thead>
                <tr><th>Nombre</th><th>Correo</th><th>Perfil</th><th>Registrado</th><th><span class="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                @for (c of filtrados(); track c.id) {
                  <tr>
                    <td>{{ c.nombreCompleto }}</td>
                    <td>{{ c.email }}</td>
                    <td>
                      <span class="estado-badge" [class.estado-badge--aceptada]="!!perfilesPorId()[c.id]" [class.estado-badge--rechazada]="!perfilesPorId()[c.id]">
                        {{ perfilesPorId()[c.id] ? 'Completo' : 'Incompleto' }}
                      </span>
                    </td>
                    <td>{{ fechaCorta(c.fechaCreacion) }}</td>
                    <td style="text-align: right; white-space: nowrap">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="seleccionado.set(c)">Ver perfil</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
          <p class="text-muted" style="font-size: 12px; margin-top: 12px">Mostrando {{ filtrados().length }} de {{ candidatos()!.length }} candidatos</p>
        </div>
      </main>
    }
  `,
})
export class CandidatosPage {
  private readonly auth = inject(AuthService);
  protected readonly candidatos = signal<any[] | null>(null);
  protected readonly perfilesPorId = signal<Record<string, any>>({});
  protected readonly error = signal('');
  protected readonly busqueda = signal('');
  protected readonly filtroPerfil = signal('todos'); // todos | completo | incompleto
  protected readonly seleccionado = signal<any>(null);
  protected readonly categorias = CATEGORIAS_DOCUMENTOS;
  protected readonly fechaCorta = fechaCorta;

  constructor() {
    const token = this.auth.token();
    Promise.all([authApi.listarCandidatos(token), perfilesApi.listarTodos(token)])
      .then(([listaCandidatos, listaPerfiles]) => {
        this.candidatos.set(listaCandidatos);
        this.perfilesPorId.set(Object.fromEntries(listaPerfiles.map((p: any) => [p.usuarioId, p])));
      })
      .catch(() => this.error.set('No se pudieron cargar los candidatos.'));
  }

  protected filtrados(): any[] {
    const perfiles = this.perfilesPorId();
    const filtro = this.filtroPerfil();
    const busqueda = this.busqueda();
    return (this.candidatos() || []).filter((c) => {
      const tienePerfil = !!perfiles[c.id];
      if (filtro === 'completo' && !tienePerfil) return false;
      if (filtro === 'incompleto' && tienePerfil) return false;
      if (!busqueda.trim()) return true;
      const cedula = perfiles[c.id]?.datosPersonales?.cedula || '';
      return `${c.nombreCompleto} ${cedula}`.toLowerCase().includes(busqueda.toLowerCase());
    });
  }

  protected filasDatosPersonales(perfil: any): any[] {
    const dp = perfil?.datosPersonales || {};
    return [
      { etiqueta: 'Cédula', valor: dp.cedula || '—' },
      { etiqueta: 'Residencia', valor: `${dp.direccion}, ${dp.municipio}, ${dp.deptoResidencia}` },
      { etiqueta: 'Celular', valor: dp.celular || '—' },
    ];
  }

  protected filasRegistrosII(perfil: any): any[] {
    return (perfil.registrosII || []).map((r: any) => ({
      tipo: r.tipoLabel,
      detalle: detalleRegistroII(r),
      establecimiento: r.establecimiento || r.enteCertificador || '—',
    }));
  }

  protected descargar(usuarioId: string, categoriaApi: string, indice: number, nombre: string): void {
    perfilesApi.descargarDocumentoDeCandidato(usuarioId, categoriaApi, indice, nombre, this.auth.token());
  }
}
