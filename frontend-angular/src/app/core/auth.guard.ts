import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export type NivelAcceso = 'cualquiera' | 'gestion' | 'admin';

/**
 * Equivalente de <ProtectedRoute> (parte de redirecciones):
 *  - sin sesión → /login (recordando a dónde quería ir, para volver después).
 *  - candidato sin el perfil completo → /completar-perfil, sin importar la ruta.
 *
 * La parte de "No tienes permisos para ver esta sección" (nivel gestion/admin)
 * la resuelve `rolGuard` (ver app.routes.ts).
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Al recargar la página, el estado del perfil todavía no ha llegado (null):
  // se espera antes de decidir, para que la página protegida no alcance a verse.
  if (auth.autenticado() && auth.usuario()?.rol === 'candidato' && auth.perfilCompletado() === null) {
    await auth.esperarEstadoPerfil();
  }

  // Va después de esperar: si el servidor rechazó el token, la sesión ya se cerró.
  if (!auth.autenticado()) {
    const pathname = state.url.split(/[?#]/)[0];
    router.navigate(['/login'], { state: { from: { pathname } }, replaceUrl: true });
    return false;
  }

  // Si la última consulta del perfil falló, se reintenta en segundo plano.
  auth.revisarEstadoSiQuedoEnDuda();

  const pathname = state.url.split(/[?#]/)[0];
  if (auth.usuario()?.rol === 'candidato' && auth.perfilCompletado() === false && pathname !== '/completar-perfil') {
    return router.createUrlTree(['/completar-perfil']);
  }

  return true;
};

/**
 * Para /login y /registro: con la sesión ya iniciada no tiene sentido verlas
 * (y en /registro se podría crear una segunda cuenta). Se manda al inicio, donde
 * authGuard decide si toca /completar-perfil.
 */
export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.autenticado() ? inject(Router).createUrlTree(['/']) : true;
};

/**
 * Solo deja "coincidir" la ruta real si el rol alcanza. Si no, el router pasa a
 * la ruta gemela que muestra "No tienes permisos para ver esta sección" en la
 * misma URL — igual que <ProtectedRoute>, la página real ni se crea (no llama
 * a la API).
 */
export function rolGuard(nivel: NivelAcceso): CanMatchFn {
  return () => {
    const auth = inject(AuthService);
    if (nivel === 'gestion') return auth.esGestion();
    if (nivel === 'admin') return auth.usuario()?.rol === 'admin';
    return true;
  };
}
