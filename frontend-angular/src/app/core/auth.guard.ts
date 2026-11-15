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
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.autenticado()) {
    const pathname = state.url.split(/[?#]/)[0];
    router.navigate(['/login'], { state: { from: { pathname } }, replaceUrl: true });
    return false;
  }

  const pathname = state.url.split(/[?#]/)[0];
  if (auth.usuario()?.rol === 'candidato' && auth.perfilCompletado() === false && pathname !== '/completar-perfil') {
    return router.createUrlTree(['/completar-perfil']);
  }

  return true;
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
