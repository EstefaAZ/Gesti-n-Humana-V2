import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './core/auth.service';
/**
 * Equivalente de App.jsx. Las páginas públicas (login, registro…) van a
 * pantalla completa; las que exigen sesión cuelgan de la ruta de layout
 * `Shell` (sidebar + contenido), ver app.routes.ts.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Ruta activa: path y nivel de acceso que exige (undefined = pública). */
  private readonly rutaActual = signal<{ pathname: string; nivel?: string }>({ pathname: '' });

  /**
   * En pantallas angostas las tablas anchas tienen scroll horizontal propio:
   * las que de verdad se desplazan reciben tabindex="0" para que también se
   * puedan recorrer con el teclado (flechas).
   */
  private hacerTablasEnfocables(): void {
    let pendiente = false;
    const revisar = () => {
      pendiente = false;
      for (const t of Array.from(document.querySelectorAll<HTMLElement>('table.plain-table'))) {
        const desplazable = t.scrollWidth > t.clientWidth + 1;
        if (desplazable && !t.hasAttribute('tabindex')) {
          t.setAttribute('tabindex', '0');
          t.setAttribute('aria-label', 'Tabla con desplazamiento horizontal');
        } else if (!desplazable && t.getAttribute('tabindex') === '0') {
          t.removeAttribute('tabindex');
          t.removeAttribute('aria-label');
        }
      }
    };
    const programar = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(revisar);
    };
    new MutationObserver(programar).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', programar);
  }

  constructor() {
    this.hacerTablasEnfocables();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      let snap: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
      while (snap.firstChild) snap = snap.firstChild;
      this.rutaActual.set({
        pathname: this.router.url.split(/[?#]/)[0],
        nivel: snap.data?.['nivel'],
      });
    });

    // <ProtectedRoute> reaccionaba en vivo a cambios de sesión/perfil (no solo
    // al navegar): al cerrar sesión, o cuando llega la respuesta de "perfil
    // completo = false", redirige igual que antes.
    effect(() => {
      const { pathname, nivel } = this.rutaActual();
      if (!nivel) return; // ruta pública
      if (!this.auth.autenticado()) {
        this.router.navigate(['/login'], { state: { from: { pathname } }, replaceUrl: true });
        return;
      }
      if (this.auth.usuario()?.rol === 'candidato' && this.auth.perfilCompletado() === false && pathname !== '/completar-perfil') {
        this.router.navigate(['/completar-perfil'], { replaceUrl: true });
      }
    });
  }
}
