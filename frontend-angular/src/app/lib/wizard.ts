import { signal } from '@angular/core';
import { STEPS, nuevoRegistroII, nuevaExperiencia, nuevoFamiliar } from './formState';
import { categoriasLicenciaDe } from '../data/catalogos';

/** Fecha de hoy como "AAAA-MM-DD" en hora local (igual que la guarda un <input type="date">). */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Qué le falta o sobra a las fechas de una experiencia laboral, o '' si están bien.
 * Sin estas fechas la evaluación automática no puede contar el tiempo trabajado.
 */
export function problemaFechasExperiencia(e: any): string {
  const hoy = hoyISO();
  if (!e.fechaInicio) return 'falta la fecha de inicio.';
  if (e.fechaInicio > hoy) return 'la fecha de inicio no puede ser futura.';
  if (e.actual) return '';
  if (!e.fechaTerminacion) return 'falta la fecha de terminación (o marca "Trabajo actualmente aquí").';
  if (e.fechaTerminacion > hoy) return 'la fecha de terminación no puede ser futura; si sigues trabajando ahí, marca "Trabajo actualmente aquí".';
  if (e.fechaTerminacion < e.fechaInicio) return 'la fecha de terminación es anterior a la de inicio.';
  return '';
}

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

    if (step === 'I' && state.datosPersonales.licencia === 'si' && categoriasLicenciaDe(state.datosPersonales).length === 0) {
      nuevosErrores['licenciaClases'] = 'Marque al menos una categoría de su licencia, o responda "No".';
    }
    // Quien tiene vehículo debe tener licencia de conducción.
    if (step === 'I' && state.datosPersonales.tieneVehiculo === 'si' && state.datosPersonales.licencia !== 'si') {
      nuevosErrores['tieneVehiculo'] = 'Si tiene vehículo, debe tener licencia de conducción: marque "Sí" en la licencia e indique sus categorías.';
    }

    if (step === 'II' && state.registrosII.length === 0) {
      nuevosErrores['registrosII'] = 'Debes agregar al menos un estudio para continuar.';
    }

    if (step === 'VI') {
      if (state.experiencias.length === 0) {
        nuevosErrores['experiencias'] = 'Debes agregar al menos una experiencia laboral para continuar.';
      } else {
        const problemas = state.experiencias
          .map((e: any, i: number) => {
            const p = problemaFechasExperiencia(e);
            return p ? `${e.empresa?.trim() || `Experiencia ${i + 1}`}: ${p}` : '';
          })
          .filter(Boolean);
        if (problemas.length) nuevosErrores['experiencias'] = 'Revisa las fechas. ' + problemas.join(' ');
      }
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
