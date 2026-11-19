import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocHeader } from '../../components/doc-header';
import { Icon } from '../../shared/icon';
import { AuthService } from '../../core/auth.service';
import * as authApi from '../../lib/api/authApi';
import * as vacantesApi from '../../lib/api/vacantesApi';
import * as solicitudesApi from '../../lib/api/solicitudesApi';

type Modulo = 'login' | 'vacantes' | 'candidatos';
type Periodo = 'todo' | 'hoy' | '7' | '30';

/** Nombres pensados para quien lee la auditoría, no para el código. */
const MODULOS: Record<Modulo, { etiqueta: string; icono: string }> = {
  login: { etiqueta: 'Cuentas', icono: 'persona' },
  vacantes: { etiqueta: 'Procesos', icono: 'briefcase' },
  candidatos: { etiqueta: 'Postulaciones', icono: 'documento' },
};

const ETIQUETA_TIPO: Record<string, string> = {
  usuario_registrado: 'Registro',
  usuario_creado_interno: 'Cuenta creada',
  usuario_editado: 'Cuenta editada',
  cuenta_desactivada: 'Desactivación',
  cuenta_reactivada: 'Reactivación',
  cuenta_eliminada: 'Eliminación',
  vacante_creada: 'Proceso creado',
  vacante_actualizada: 'Proceso editado',
  vacante_cambio_estado: 'Cambio de estado',
  vacante_eliminada: 'Proceso eliminado',
  vacante_documento_subido: 'Documento',
  solicitud_creada: 'Postulación',
  estado_cambiado: 'Cambio de estado',
  postulacion_retirada: 'Retiro',
  solicitud_retirada: 'Retiro',
  solicitud_eliminada: 'Eliminación',
  anonimizacion_ejecutada: 'Anonimización',
};
/** Eventos que conviene resaltar: quitan acceso o borran información. */
const TIPOS_SENSIBLES = new Set(['cuenta_desactivada', 'cuenta_eliminada', 'vacante_eliminada', 'solicitud_eliminada', 'anonimizacion_ejecutada']);

const ETIQUETA_ROL: Record<string, string> = { candidato: 'Candidato', gestor_humano: 'Gestión Humana', admin: 'Administrador' };
const POR_PAGINA = 60;

const FORMATO_HORA = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' });
const FORMATO_DIA = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const FORMATO_COMPLETO = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

function inicioDelDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

interface Grupo {
  clave: number;
  titulo: string;
  eventos: any[];
}

@Component({
  selector: 'app-auditoria-page',
  imports: [FormsModule, DocHeader, Icon],
  host: { style: 'display: contents' },
  template: `
    <app-doc-header title="Auditoría" />
    <main class="page">
      <div class="ps-encabezado">
        <div>
          <h2 class="ps-encabezado__titulo">Auditoría</h2>
          <p class="ps-encabezado__resumen">Quién hizo qué y cuándo en cuentas, procesos y postulaciones. Se muestran los últimos 100 eventos de cada módulo.</p>
        </div>
        @if (eventos()?.length) {
          <button type="button" class="btn btn-secondary btn-sm" (click)="exportar()" [disabled]="filtrados().length === 0">
            <app-icon name="descargar" [size]="15" [strokeWidth]="2" />Exportar CSV
          </button>
        }
      </div>

      @if (error()) {
        <div class="notice notice--danger">{{ error() }}</div>
      } @else if (eventos() === null) {
        <div class="ps-tarjeta cand-vacio"><p class="text-muted" style="margin: 0">Cargando auditoría…</p></div>
      } @else {
        <dl class="ps-datos rp-resumen">
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Hoy</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ resumen().hoy }}</dd>
            <span class="ps-dato__sub">eventos</span>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Últimos 7 días</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ resumen().semana }}</dd>
            <span class="ps-dato__sub">eventos</span>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Personas</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ resumen().actores }}</dd>
            <span class="ps-dato__sub">con actividad registrada</span>
          </div>
          <div class="ps-dato">
            <dt class="ps-dato__etiqueta">Acciones sensibles</dt>
            <dd class="ps-dato__valor ps-dato__valor--grande" style="margin: 0">{{ resumen().sensibles }}</dd>
            <span class="ps-dato__sub">Desactivaciones y eliminaciones</span>
          </div>
        </dl>

        <div class="ps-tarjeta">
          <div class="ps-barra">
            <div class="au-controles">
              <div class="ps-buscador">
                <span class="ps-buscador__icono" aria-hidden="true"><app-icon name="buscar" [size]="16" [strokeWidth]="2" /></span>
                <input type="search" aria-label="Buscar eventos" autocomplete="off" placeholder="Buscar por descripción o persona…" [value]="busqueda()" (input)="busqueda.set($any($event.target).value); limite.set(porPagina)" />
              </div>
              <select class="au-periodo" aria-label="Periodo" [ngModel]="periodo()" (ngModelChange)="periodo.set($event); limite.set(porPagina)">
                <option value="todo">Todo el historial</option>
                <option value="hoy">Hoy</option>
                <option value="7">Últimos 7 días</option>
                <option value="30">Últimos 30 días</option>
              </select>
            </div>
            <div class="ps-filtros" role="group" aria-label="Filtrar por módulo">
              @for (f of filtrosModulo; track f.valor) {
                <button type="button" class="ps-chip" [class.is-activo]="modulo() === f.valor" [class.is-vacio]="cuantos(f.valor) === 0" [attr.aria-pressed]="modulo() === f.valor" (click)="modulo.set(f.valor); limite.set(porPagina)">
                  {{ f.etiqueta }} <span class="ps-chip__conteo">{{ cuantos(f.valor) }}</span>
                </button>
              }
              <button type="button" class="ps-chip" [class.is-activo]="soloSensibles()" [attr.aria-pressed]="soloSensibles()" (click)="soloSensibles.set(!soloSensibles()); limite.set(porPagina)">
                Solo sensibles
              </button>
            </div>
          </div>

          @if (filtrados().length === 0) {
            <div class="ps-vacio">
              <p style="margin: 0">{{ eventos()!.length === 0 ? 'Todavía no hay eventos registrados.' : 'Ningún evento coincide con la búsqueda o los filtros.' }}</p>
              @if (eventos()!.length > 0) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="limpiar()">Quitar filtros</button>
              }
            </div>
          } @else {
            @for (g of grupos(); track g.clave) {
              <section class="au-dia" [attr.aria-label]="g.titulo">
                <h3 class="au-dia__titulo">{{ g.titulo }} <span class="au-dia__conteo">{{ g.eventos.length }}</span></h3>
                <ol class="au-lista">
                  @for (e of g.eventos; track e.modulo + '-' + e.id) {
                    <li class="au-evento" [class.is-sensible]="sensibles.has(e.tipo)">
                      <time class="au-evento__hora" [attr.datetime]="e.fecha" [attr.title]="fechaCompleta(e.fecha)">{{ hora(e.fecha) }}</time>
                      <span class="au-evento__icono au-evento__icono--{{ e.modulo }}" [attr.title]="modulos[$any(e.modulo)].etiqueta">
                        <app-icon [name]="modulos[$any(e.modulo)].icono" [size]="15" [strokeWidth]="2" />
                      </span>
                      <div class="au-evento__cuerpo">
                        <p class="au-evento__descripcion">{{ e.descripcion }}</p>
                        <div class="au-evento__meta">
                          <span class="au-tipo">{{ etiquetaTipo(e.tipo) }}</span>
                          <span>{{ modulos[$any(e.modulo)].etiqueta }}</span>
                          <span class="au-evento__actor">
                            @if (e.actorNombre) {
                              por <strong>{{ e.actorNombre }}</strong>@if (e.actorRol) {<span> · {{ etiquetaRol[e.actorRol] || e.actorRol }}</span>}
                            } @else {
                              Sistema
                            }
                          </span>
                        </div>
                      </div>
                    </li>
                  }
                </ol>
              </section>
            }
            <div class="ps-pie-tabla us-pie">
              <span>Mostrando {{ visibles().length }} de {{ filtrados().length }} eventos</span>
              @if (visibles().length < filtrados().length) {
                <button type="button" class="btn btn-secondary btn-sm" (click)="limite.set(limite() + porPagina)">Mostrar más</button>
              }
            </div>
          }
        </div>
      }
    </main>
  `,
})
export class AuditoriaPage {
  private readonly auth = inject(AuthService);
  protected readonly modulos = MODULOS;
  protected readonly etiquetaRol = ETIQUETA_ROL;
  protected readonly sensibles = TIPOS_SENSIBLES;
  protected readonly porPagina = POR_PAGINA;
  protected readonly filtrosModulo: { valor: Modulo | 'todos'; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: 'Todos' },
    { valor: 'login', etiqueta: MODULOS.login.etiqueta },
    { valor: 'vacantes', etiqueta: MODULOS.vacantes.etiqueta },
    { valor: 'candidatos', etiqueta: MODULOS.candidatos.etiqueta },
  ];

  protected readonly eventos = signal<any[] | null>(null);
  protected readonly error = signal('');
  protected readonly modulo = signal<Modulo | 'todos'>('todos');
  protected readonly periodo = signal<Periodo>('todo');
  protected readonly soloSensibles = signal(false);
  protected readonly busqueda = signal('');
  protected readonly limite = signal(POR_PAGINA);

  protected readonly resumen = computed(() => {
    const lista = this.eventos() || [];
    const hoy = inicioDelDia(new Date());
    const semana = hoy - 6 * 86_400_000;
    const t = (e: any) => new Date(e.fecha).getTime();
    return {
      hoy: lista.filter((e) => t(e) >= hoy).length,
      semana: lista.filter((e) => t(e) >= semana).length,
      actores: new Set(lista.map((e) => e.actorNombre).filter(Boolean)).size,
      sensibles: lista.filter((e) => TIPOS_SENSIBLES.has(e.tipo)).length,
    };
  });

  /** Filtros de periodo, sensibles y búsqueda (sin el de módulo, para contar por módulo). */
  private readonly sinFiltroModulo = computed(() => {
    const busqueda = this.busqueda().trim().toLowerCase();
    const periodo = this.periodo();
    const hoy = inicioDelDia(new Date());
    const desde = periodo === 'todo' ? -Infinity : periodo === 'hoy' ? hoy : hoy - (Number(periodo) - 1) * 86_400_000;
    return (this.eventos() || []).filter((e) => {
      if (new Date(e.fecha).getTime() < desde) return false;
      if (this.soloSensibles() && !TIPOS_SENSIBLES.has(e.tipo)) return false;
      if (busqueda && !`${e.descripcion} ${e.actorNombre || ''}`.toLowerCase().includes(busqueda)) return false;
      return true;
    });
  });

  protected readonly filtrados = computed(() => {
    const m = this.modulo();
    return this.sinFiltroModulo().filter((e) => m === 'todos' || e.modulo === m);
  });

  protected readonly visibles = computed(() => this.filtrados().slice(0, this.limite()));

  /** Eventos agrupados por día ("Hoy", "Ayer" o la fecha). */
  protected readonly grupos = computed<Grupo[]>(() => {
    const hoy = inicioDelDia(new Date());
    const grupos: Grupo[] = [];
    for (const e of this.visibles()) {
      const clave = inicioDelDia(new Date(e.fecha));
      let g = grupos[grupos.length - 1];
      if (!g || g.clave !== clave) {
        const titulo = clave === hoy ? 'Hoy' : clave === hoy - 86_400_000 ? 'Ayer' : FORMATO_DIA.format(new Date(clave));
        g = { clave, titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), eventos: [] };
        grupos.push(g);
      }
      g.eventos.push(e);
    }
    return grupos;
  });

  constructor() {
    const token = this.auth.token();
    Promise.all([authApi.obtenerAuditoria(token, 100), vacantesApi.obtenerAuditoria(token, 100), solicitudesApi.obtenerAuditoria(token, 100)])
      .then(([login, vacantes, candidatos]) => {
        const combinados = [
          ...login.map((e: any) => ({ ...e, modulo: 'login' })),
          ...vacantes.map((e: any) => ({ ...e, modulo: 'vacantes' })),
          ...candidatos.map((e: any) => ({ ...e, modulo: 'candidatos' })),
        ]
          .filter((e) => e.fecha)
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        this.eventos.set(combinados);
      })
      .catch(() => this.error.set('No se pudo cargar la auditoría. Verifica que los 3 backends estén corriendo.'));
  }

  protected cuantos(m: Modulo | 'todos'): number {
    const lista = this.sinFiltroModulo();
    return m === 'todos' ? lista.length : lista.filter((e) => e.modulo === m).length;
  }

  protected etiquetaTipo(tipo: string): string {
    return ETIQUETA_TIPO[tipo] || (tipo || 'Evento').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  protected hora(fecha: string): string {
    return FORMATO_HORA.format(new Date(fecha));
  }

  protected fechaCompleta(fecha: string): string {
    return FORMATO_COMPLETO.format(new Date(fecha));
  }

  protected limpiar(): void {
    this.busqueda.set('');
    this.modulo.set('todos');
    this.periodo.set('todo');
    this.soloSensibles.set(false);
    this.limite.set(POR_PAGINA);
  }

  /** Descarga en CSV los eventos que se ven con los filtros actuales. */
  protected exportar(): void {
    const celda = (v: any) => {
      let s = String(v ?? '');
      // Evita que Excel interprete el texto como fórmula.
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const filas = [
      ['Fecha', 'Módulo', 'Tipo', 'Descripción', 'Actor', 'Rol del actor'],
      ...this.filtrados().map((e) => [
        this.fechaCompleta(e.fecha),
        MODULOS[e.modulo as Modulo].etiqueta,
        this.etiquetaTipo(e.tipo),
        e.descripcion,
        e.actorNombre || 'Sistema',
        ETIQUETA_ROL[e.actorRol] || e.actorRol || '',
      ]),
    ];
    const csv = '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
