import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DocHeader } from '../components/doc-header';
import { FolioNav } from '../components/folio-nav';
import { HojaI } from '../components/steps/hoja-i';
import { HojaII } from '../components/steps/hoja-ii';
import { HojaVI } from '../components/steps/hoja-vi';
import { HojaVII } from '../components/steps/hoja-vii';
import { HojaVIII } from '../components/steps/hoja-viii';
import { HojaDocumentos } from '../components/steps/hoja-documentos';
import { Confirmacion } from '../components/steps/confirmacion';
import { STEPS, initialSolicitudState } from '../lib/formState';
import { WizardBase } from '../lib/wizard';
import { AuthService } from '../core/auth.service';
import * as vacantesApi from '../lib/api/vacantesApi';
import * as solicitudesApi from '../lib/api/solicitudesApi';
import { ApiError } from '../lib/api/httpClient';

import { formatearFecha } from '../lib/formato';

@Component({
  selector: 'app-solicitud-page',
  imports: [RouterLink, DocHeader, FolioNav, HojaI, HojaII, HojaVI, HojaVII, HojaVIII, HojaDocumentos, Confirmacion],
  host: { style: 'display: contents' },
  template: `
    @if (errorCarga()) {
      <app-doc-header title="Error" />
      <main class="page"><div class="card"><div class="notice notice--danger">{{ errorCarga() }}</div></div></main>
    } @else if (vacante() === undefined || (vacante() && !state())) {
      <!-- cargando -->
    } @else if (!vacante()) {
      <app-doc-header title="Vacante no encontrada" />
      <main class="page">
        <div class="card">
          <div class="empty-state">No encontramos esta vacante. Puede que ya no esté disponible.</div>
          <p class="text-center mt-24"><a routerLink="/" class="text-muted">← Ver todas las vacantes</a></p>
        </div>
      </main>
    } @else if (vacante().estaCerrada && !enviado()) {
      <app-doc-header [title]="vacante().cargo" />
      <main class="page">
        <div class="card">
          <div class="notice notice--danger">
            Esta convocatoria cerró el {{ fecha(vacante().fechaCierre) }} a las {{ vacante().horaCierre }}. Ya no se reciben inscripciones para este proceso.
          </div>
          <p class="text-center"><a routerLink="/" class="text-muted">← Ver todas las vacantes</a></p>
        </div>
      </main>
    } @else {
      <app-doc-header [title]="'Solicitud de Inscripción — ' + vacante().cargo" />
      <main class="page">
        <div class="card">
          @if (!enviado()) {
            <div class="notice notice--info">
              Proceso {{ vacante().procesoNo }} — {{ vacante().cargo }}. El proceso y la fecha de cierre quedan tomados de esta
              convocatoria y no se pueden editar.
            </div>
          }
          @if (errorEnvio()) {
            <div class="notice notice--danger">{{ errorEnvio() }}</div>
          }

          @if (!enviado()) {
            <app-folio-nav [steps]="steps" [activeStep]="activeStep()" [doneSteps]="doneSteps()" />
          }

          @switch (activeStep()) {
            @case ('I') {
              <app-hoja-i [datos]="datosConLock()" (setDatos)="setDatos($event)" [errors]="errors()" />
            }
            @case ('II') {
              <app-hoja-ii [registros]="state().registrosII" (agregar)="addRegistro()" (quitar)="removeRegistro($event)" (cambiar)="changeRegistro($event)" />
            }
            @case ('VI') {
              <app-hoja-vi
                [experiencias]="state().experiencias"
                (agregar)="addExperiencia()"
                (quitar)="removeExperiencia($event)"
                (cambiar)="changeExperiencia($event)"
              />
            }
            @case ('VII') {
              <app-hoja-vii
                [conflicto]="state().conflicto"
                (setConflicto)="setConflicto($event)"
                (agregarFamiliar)="addFamiliar()"
                (quitarFamiliar)="removeFamiliar($event)"
                (cambiarFamiliar)="changeFamiliar($event)"
                [errors]="errors()"
              />
            }
            @case ('VIII') {
              <app-hoja-viii [autorizacion]="state().autorizacion" (setAutorizacion)="setAutorizacion($event)" [errors]="errors()" />
            }
            @case ('DOCS') {
              <app-hoja-documentos [documentos]="state().documentos" (setDocumentos)="setDocumentos($event)" [errors]="errors()" />
            }
            @case ('confirmacion') {
              <app-confirmacion [radicado]="radicado()" (descargarPdf)="descargarPdf()" />
            }
          }

          @if (!enviado()) {
            <div class="wizard-actions">
              <button type="button" class="btn btn-secondary" (click)="onAtras()" [style.visibility]="stepIndex() === 0 ? 'hidden' : 'visible'">
                Atrás
              </button>
              <button type="button" class="btn btn-primary" (click)="onSiguiente()" [disabled]="enviando()">
                {{ enviando() ? 'Enviando…' : steps[stepIndex()] === 'VIII' ? 'Enviar solicitud' : 'Siguiente' }}
              </button>
            </div>
          }
        </div>
      </main>
    }
  `,
})
export class SolicitudPage extends WizardBase {
  protected readonly fecha = formatearFecha;
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  protected readonly vacante = signal<any>(undefined); // undefined = cargando, null = no encontrada
  protected readonly errorCarga = signal('');
  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal('');
  protected readonly enviado = signal(false);
  protected readonly radicado = signal<string | null>(null);

  constructor() {
    super();
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const vacanteId = params.get('id');
      vacantesApi
        .obtenerPublica(vacanteId)
        .then((v) => {
          this.vacante.set(v);
          if (v) {
            this.state.set(initialSolicitudState({ proceso: v.procesoNo, fechaEntrega: v.fechaCierre, locked: true }));
          }
        })
        .catch((e) => (e.status === 404 ? this.vacante.set(null) : this.errorCarga.set('No se pudo cargar la vacante.')));
    });
  }

  protected activeStep(): string {
    return this.enviado() ? 'confirmacion' : STEPS[this.stepIndex()];
  }

  protected datosConLock(): any {
    return { ...this.state().datosPersonales, urlLocked: true };
  }

  protected onSiguiente(): void {
    if (!this.validarPasoActual()) return;
    if (STEPS[this.stepIndex()] === 'VIII') {
      this.finalizarSolicitud();
      return;
    }
    this.stepIndex.update((i) => i + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected onAtras(): void {
    this.stepIndex.update((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private async finalizarSolicitud(): Promise<void> {
    const state = this.state();
    this.errorEnvio.set('');
    this.enviando.set(true);
    try {
      const solicitud = await solicitudesApi.crear(
        {
          vacanteId: this.vacante().id,
          datosPersonales: state.datosPersonales,
          registrosII: state.registrosII,
          experiencia: state.experiencias,
          conflicto: state.conflicto,
          autorizacion: state.autorizacion,
          documentosAdjuntos: state.documentos,
        },
        this.auth.token(),
      );
      this.radicado.set(solicitud.radicado);
      this.enviado.set(true);
    } catch (e: any) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 503)) {
        this.errorEnvio.set(e.detail || 'Ya existe una solicitud tuya para esta vacante, o la convocatoria ya cerró.');
      } else {
        this.errorEnvio.set('No se pudo enviar la solicitud. Intenta de nuevo.');
      }
    } finally {
      this.enviando.set(false);
    }
  }

  protected descargarPdf(): void {
    solicitudesApi.descargarPdf(this.radicado(), this.auth.token());
  }
}
