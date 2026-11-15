import { Component, inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, rolGuard, NivelAcceso } from './core/auth.guard';
import { AuthService } from './core/auth.service';
import { Shell } from './shell';
import { ListaVacantesPage } from './pages/lista-vacantes.page';
import { VacanteDetallePage } from './pages/vacante-detalle.page';
import { SolicitudPage } from './pages/solicitud.page';
import { CompletarPerfilPage } from './pages/completar-perfil.page';
import { DocumentosPage } from './pages/documentos.page';
import { NotificacionesPage } from './pages/notificaciones.page';
import { MisPostulacionesPage } from './pages/mis-postulaciones.page';
import { PerfilPage } from './pages/perfil.page';
import { LoginPage } from './pages/login.page';
import { RegistroPage } from './pages/registro.page';
import { OlvidePasswordPage } from './pages/olvide-password.page';
import { RestablecerPasswordPage } from './pages/restablecer-password.page';
import { PoliticaDatosPage } from './pages/politica-datos.page';
import { TerminosCondicionesPage } from './pages/terminos-condiciones.page';
import { GestionHumanaPage } from './pages/hr/gestion-humana.page';
import { CandidatosPage } from './pages/hr/candidatos.page';
import { ReportesPage } from './pages/hr/reportes.page';
import { DashboardPage } from './pages/hr/dashboard.page';
import { UsuariosPage } from './pages/hr/usuarios.page';
import { AuditoriaPage } from './pages/hr/auditoria.page';

/** Rutas desconocidas no muestran nada (igual que React Router sin coincidencia). */
@Component({ selector: 'app-sin-ruta', template: '' })
class SinRuta {}

/** Lo que muestra <ProtectedRoute> cuando el rol no alcanza (sin encabezado, igual que en React). */
@Component({
  selector: 'app-sin-permiso',
  host: { style: 'display: contents' },
  template: `
    <main class="page">
      <div class="card">
        <div class="notice notice--danger">No tienes permisos para ver esta sección.</div>
      </div>
    </main>
  `,
})
class SinPermiso {}

/** Ruta que exige sesión iniciada; `nivel` indica qué rol hace falta. */
function protegida(path: string, component: any, nivel: NivelAcceso = 'cualquiera'): Routes {
  if (nivel === 'cualquiera') {
    return [{ path, component, canActivate: [authGuard], data: { nivel } }];
  }
  return [
    { path, component, canMatch: [rolGuard(nivel)], canActivate: [authGuard], data: { nivel } },
    { path, component: SinPermiso, canActivate: [authGuard], data: { nivel } },
  ];
}

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'registro', component: RegistroPage },
  { path: 'olvide-password', component: OlvidePasswordPage },
  { path: 'restablecer-password', component: RestablecerPasswordPage },
  { path: 'politica-datos', component: PoliticaDatosPage },
  { path: 'terminos-condiciones', component: TerminosCondicionesPage },

  // Todo lo demás exige sesión iniciada — nada se ve sin hacer login primero.
  // Ruta de layout: Shell (sidebar) se crea una vez y las páginas van en su outlet.
  {
    path: '',
    component: Shell,
    children: [
      ...protegida('', ListaVacantesPage),
      ...protegida('completar-perfil', CompletarPerfilPage),
      ...protegida('documentos', DocumentosPage),
      ...protegida('notificaciones', NotificacionesPage),
      ...protegida('vacante/:id', VacanteDetallePage),
      ...protegida('postularme/:id', SolicitudPage),
      ...protegida('mis-postulaciones', MisPostulacionesPage),
      ...protegida('perfil', PerfilPage),
      ...protegida('gestion-humana', GestionHumanaPage, 'gestion'),
      ...protegida('candidatos', CandidatosPage, 'gestion'),
      ...protegida('reportes', ReportesPage, 'gestion'),
      ...protegida('dashboard', DashboardPage, 'admin'),
      ...protegida('usuarios', UsuariosPage, 'admin'),
      ...protegida('auditoria', AuditoriaPage, 'admin'),
      // Ruta desconocida con sesión: en blanco pero con el sidebar (como antes).
      // Sin sesión no coincide y cae al '**' de abajo, a pantalla completa.
      { path: '**', component: SinRuta, canMatch: [() => inject(AuthService).autenticado()] },
    ],
  },
  { path: '**', component: SinRuta },
];
