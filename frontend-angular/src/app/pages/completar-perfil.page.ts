import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DocHeader } from '../components/doc-header';
import { FolioNav } from '../components/folio-nav';
import { HojaI } from '../components/steps/hoja-i';
import { HojaII } from '../components/steps/hoja-ii';
import { HojaVI } from '../components/steps/hoja-vi';
import { HojaVII } from '../components/steps/hoja-vii';
import { HojaVIII } from '../components/steps/hoja-viii';
import { HojaDocumentos } from '../components/steps/hoja-documentos';
import { STEPS, initialSolicitudState } from '../lib/formState';
import { WizardBase } from '../lib/wizard';
import { AuthService } from '../core/auth.service';
import * as perfilesApi from '../lib/api/perfilesApi';
import { ApiError } from '../lib/api/httpClient';

/**
 * Estado inicial para quien todavía no tiene perfil guardado: arranca en
 * blanco pero con lo que ya quedó en la cuenta al registrarse (nombre,
 * cédula, correo) — así no se le vuelve a pedir algo que ya escribió, y
 * puede corregirlo aquí si lo necesita.
 */
function _estadoInicialConDatosDeRegistro(usuario: any): any {
  const estado = initialSolicitudState();
  estado.datosPersonales = {
    ...estado.datosPersonales,
    nombreCompleto: usuario?.nombreCompleto || '',
    cedula: usuario?.cedula || '',
    correo: usuario?.email || '',
  };
  return estado;
}

function _perfilAEstadoWizard(perfil: any): any {
  return {
    stepIndex: 0,
    urlLocked: false,
    datosPersonales: { proceso: '', fechaEntrega: '', ...perfil.datosPersonales },
    registrosII: perfil.registrosII || [],
    experiencias: perfil.experiencia || [],
    conflicto: perfil.conflicto?.tieneVinculo
      ? perfil.conflicto
      : { tieneVinculo: 'no', familiares: [], tieneOtraInhabilidad: 'no', descripcionInhabilidad: '', ...perfil.conflicto },
    autorizacion: { acepta: perfil.autorizacion?.acepta ?? false, nombreCompleto: perfil.autorizacion?.nombreCompleto || '' },
    documentos: {
      cedula: perfil.documentosAdjuntos?.cedula || [],
      certificadosLaborales: perfil.documentosAdjuntos?.certificadosLaborales || [],
      certificadosEstudio: perfil.documentosAdjuntos?.certificadosEstudio || [],
      tarjetaProfesional: perfil.documentosAdjuntos?.tarjetaProfesional || [],
    },
    errors: {},
  };
}

@Component({
  selector: 'app-completar-perfil-page',
  imports: [DocHeader, FolioNav, HojaI, HojaII, HojaVI, HojaVII, HojaVIII, HojaDocumentos],
  host: { style: 'display: contents' },
  template: `
    @if (!cargando() && state()) {
      <app-doc-header title="Completa tu perfil" [showCode]="false" />
      <main class="page">
        <div class="card">
          <div class="notice notice--info">
            Este formulario se llena <strong>una sola vez</strong>. Tu progreso se guarda automáticamente mientras
            avanzas — si te cierran, te tienes que ausentar o cierras el navegador, puedes volver más tarde y
            retomar exactamente donde quedaste. Cuando termines, podrás inscribirte a cualquier vacante con un solo
            clic sin volver a llenarlo, solo adjuntando certificaciones extra si una vacante en particular las requiere.
          </div>
          @if (errorEnvio()) {
            <div class="notice notice--danger">{{ errorEnvio() }}</div>
          }

          <app-folio-nav [steps]="steps" [activeStep]="activeStepBase()" [doneSteps]="doneSteps()" />

          @switch (activeStepBase()) {
            @case ('I') {
              <app-hoja-i [datos]="state().datosPersonales" (setDatos)="setDatos($event)" [errors]="errors()" ocultarProceso />
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
            @case ('DOCS') {
              <app-hoja-documentos [documentos]="state().documentos" (setDocumentos)="setDocumentos($event)" [errors]="errors()" />
            }
            @case ('VIII') {
              <app-hoja-viii [autorizacion]="state().autorizacion" (setAutorizacion)="setAutorizacion($event)" [errors]="errors()" />
            }
          }

          <div class="wizard-actions">
            <button type="button" class="btn btn-secondary" (click)="onAtras()" [style.visibility]="stepIndex() === 0 ? 'hidden' : 'visible'">
              Atrás
            </button>
            <span class="text-muted" style="font-size: 12px; align-self: center">{{ textoGuardado() }}</span>
            <button type="button" class="btn btn-primary" (click)="onSiguiente()" [disabled]="enviando()">
              {{ enviando() ? 'Guardando…' : steps[stepIndex()] === 'VIII' ? 'Guardar perfil' : 'Siguiente' }}
            </button>
          </div>
        </div>
      </main>
    }
  `,
})
export class CompletarPerfilPage extends WizardBase implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly enviando = signal(false);
  protected readonly errorEnvio = signal('');
  protected readonly cargando = signal(true);
  protected readonly guardandoBorrador = signal(false);
  protected readonly ultimoGuardado = signal<Date | null>(null);
  private intervalo: any = null;
  private destruido = false;

  constructor() {
    super();
    perfilesApi
      .obtenerMiPerfil(this.auth.token())
      .then((perfil) => this.state.set(_perfilAEstadoWizard(perfil)))
      .catch(() => this.state.set(_estadoInicialConDatosDeRegistro(this.auth.usuario())))
      .finally(() => {
        this.cargando.set(false);
        if (this.destruido) return;
        // Guardado automático mientras el candidato avanza — así, si cierra el
        // navegador, se ausenta o se le cierra la sesión a mitad de camino, retoma
        // exactamente donde se quedó en vez de tener que llenar todo de nuevo.
        this.intervalo = setInterval(() => this.guardarBorrador(this.state()), 30000);
      });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.intervalo) clearInterval(this.intervalo);
  }

  protected textoGuardado(): string {
    if (this.guardandoBorrador()) return 'Guardando…';
    const ultimo = this.ultimoGuardado();
    return ultimo ? `Guardado ${ultimo.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : '';
  }

  private async guardarBorrador(estadoAGuardar: any): Promise<void> {
    if (!estadoAGuardar) return;
    this.guardandoBorrador.set(true);
    try {
      await perfilesApi.guardarBorrador(
        {
          datosPersonales: estadoAGuardar.datosPersonales,
          registrosII: estadoAGuardar.registrosII,
          experiencia: estadoAGuardar.experiencias,
          conflicto: estadoAGuardar.conflicto,
          autorizacion: estadoAGuardar.autorizacion,
          documentosAdjuntos: estadoAGuardar.documentos,
        },
        this.auth.token(),
      );
      this.ultimoGuardado.set(new Date());
    } catch {
      // El autoguardado nunca debe interrumpir al candidato si falla — solo se reintenta en el siguiente paso.
    } finally {
      this.guardandoBorrador.set(false);
    }
  }

  protected onSiguiente(): void {
    if (!this.validarPasoActual()) return;
    if (STEPS[this.stepIndex()] === 'VIII') {
      this.finalizarPerfil();
      return;
    }
    this.guardarBorrador(this.state());
    this.stepIndex.update((i) => i + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected onAtras(): void {
    this.guardarBorrador(this.state());
    this.stepIndex.update((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private async finalizarPerfil(): Promise<void> {
    const state = this.state();
    this.errorEnvio.set('');
    this.enviando.set(true);
    try {
      await perfilesApi.guardarPerfil(
        {
          datosPersonales: state.datosPersonales,
          registrosII: state.registrosII,
          experiencia: state.experiencias,
          conflicto: state.conflicto,
          autorizacion: state.autorizacion,
          documentosAdjuntos: state.documentos,
        },
        this.auth.token(),
      );
      await this.auth.refrescarEstadoPerfil();
      this.router.navigate(['/']);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 422 && typeof e.detail === 'string' && e.detail.includes('Autorización')) {
        this.errorEnvio.set(e.detail);
        this.stepIndex.set(STEPS.indexOf('VIII'));
      } else {
        this.errorEnvio.set('No se pudo guardar tu perfil. Intenta de nuevo.');
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
