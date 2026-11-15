import { signal } from '@angular/core';
import { STEPS, nuevoRegistroII, nuevaExperiencia, nuevoFamiliar } from './formState';

/**
 * Lógica compartida del formulario por hojas (GTH-FOR-03) que usan
 * SolicitudPage y CompletarPerfilPage. En React estas funciones estaban
 * duplicadas en las dos páginas; aquí viven una sola vez con el mismo
 * comportamiento (actualizaciones inmutables del estado, mismos límites y
 * mismas validaciones por paso).
 */
export class WizardBase {
  readonly steps = STEPS;
  readonly state = signal<any>(null);
  readonly stepIndex = signal(0);
  readonly errors = signal<any>({});

  activeStepBase(): string {
    return STEPS[this.stepIndex()];
  }

  doneSteps(): string[] {
    return STEPS.slice(0, this.stepIndex());
  }

  // ---- Helpers de actualización de estado ----
  setDatos = (patch: any) => this.state.update((s) => ({ ...s, datosPersonales: { ...s.datosPersonales, ...patch } }));
  setConflicto = (patch: any) => this.state.update((s) => ({ ...s, conflicto: { ...s.conflicto, ...patch } }));
  setAutorizacion = (patch: any) => this.state.update((s) => ({ ...s, autorizacion: { ...s.autorizacion, ...patch } }));
  setDocumentos = (updater: any) =>
    this.state.update((s) => ({
      ...s,
      documentos: typeof updater === 'function' ? updater(s.documentos) : { ...s.documentos, ...updater },
    }));

  addRegistro = () =>
    this.state.update((s) => (s.registrosII.length >= 15 ? s : { ...s, registrosII: [...s.registrosII, nuevoRegistroII()] }));
  removeRegistro = (id: string) => this.state.update((s) => ({ ...s, registrosII: s.registrosII.filter((r: any) => r.id !== id) }));
  changeRegistro = ({ id, patch }: { id: string; patch: any }) =>
    this.state.update((s) => ({ ...s, registrosII: s.registrosII.map((r: any) => (r.id === id ? { ...r, ...patch } : r)) }));

  addExperiencia = () =>
    this.state.update((s) => (s.experiencias.length >= 10 ? s : { ...s, experiencias: [...s.experiencias, nuevaExperiencia()] }));
  removeExperiencia = (id: string) => this.state.update((s) => ({ ...s, experiencias: s.experiencias.filter((e: any) => e.id !== id) }));
  changeExperiencia = ({ id, patch }: { id: string; patch: any }) =>
    this.state.update((s) => ({ ...s, experiencias: s.experiencias.map((e: any) => (e.id === id ? { ...e, ...patch } : e)) }));

  addFamiliar = () =>
    this.state.update((s) =>
      s.conflicto.familiares.length >= 5
        ? s
        : { ...s, conflicto: { ...s.conflicto, familiares: [...s.conflicto.familiares, nuevoFamiliar()] } },
    );
  removeFamiliar = (id: string) =>
    this.state.update((s) => ({ ...s, conflicto: { ...s.conflicto, familiares: s.conflicto.familiares.filter((f: any) => f.id !== id) } }));
  changeFamiliar = ({ id, patch }: { id: string; patch: any }) =>
    this.state.update((s) => ({
      ...s,
      conflicto: { ...s.conflicto, familiares: s.conflicto.familiares.map((f: any) => (f.id === id ? { ...f, ...patch } : f)) },
    }));

  // ---- Validación ----
  validarPasoActual(): boolean {
    const step = STEPS[this.stepIndex()];
    const state = this.state();
    const nuevosErrores: Record<string, string> = {};

    if (step === 'I') {
      const requeridos = [
        'nombreCompleto', 'cedula', 'cedulaDe', 'ciudadNacimiento', 'deptoNacimiento',
        'paisNacimiento', 'fechaNacimiento', 'correo', 'direccion', 'municipio',
        'deptoResidencia', 'celular', 'estadoCivil', 'numHijos', 'tarjetaProfesional', 'profesion',
      ];
      requeridos.forEach((campo) => {
        if (!String(state.datosPersonales[campo] || '').trim()) {
          nuevosErrores[campo] = 'Este campo es obligatorio.';
        }
      });
    }

    if (step === 'VII') {
      if (state.conflicto.tieneVinculo === 'si' && state.conflicto.familiares.length === 0) {
        nuevosErrores['familiares'] = 'Agregue al menos un familiar o cambie la respuesta a "No".';
      }
      if (state.conflicto.tieneOtraInhabilidad === 'si' && !state.conflicto.descripcionInhabilidad.trim()) {
        nuevosErrores['descripcionInhabilidad'] = 'Debe describir la situación.';
      }
    }

    if (step === 'VIII') {
      if (!state.autorizacion.acepta) {
        nuevosErrores['aceptaClausulas'] = 'Debe aceptar las cláusulas.';
      } else if (!state.autorizacion.nombreCompleto.trim()) {
        nuevosErrores['nombreAutorizacion'] = 'Este campo es obligatorio.';
      }
    }

    if (step === 'DOCS') {
      const requeridos: Record<string, string> = {
        cedula: 'Debes adjuntar tu cédula de ciudadanía.',
        certificadosLaborales: 'Debes adjuntar al menos un certificado laboral con funciones.',
        certificadosEstudio: 'Debes adjuntar al menos un certificado de estudio y/o curso.',
        tarjetaProfesional: 'Debes adjuntar tu tarjeta profesional.',
      };
      Object.entries(requeridos).forEach(([clave, mensaje]) => {
        if ((state.documentos[clave] || []).length === 0) {
          nuevosErrores[clave] = mensaje;
        }
      });
      if (Object.keys(nuevosErrores).length > 0) {
        alert('Te falta adjuntar: ' + Object.values(nuevosErrores).join(' '));
      }
    }

    this.errors.set(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }
}
