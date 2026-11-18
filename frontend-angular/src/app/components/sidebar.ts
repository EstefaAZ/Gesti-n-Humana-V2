import { Component, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';
import { FotoPerfilService, iniciales } from '../core/foto-perfil.service';
import { Icon } from '../shared/icon';

interface ItemMenu {
  to?: string;
  label: string;
  icon: string;
  proximamente?: boolean;
}

function itemsPara(rol: string | undefined): ItemMenu[] {
  if (rol === 'candidato') {
    return [
      { to: '/', label: 'Vacantes', icon: 'briefcase' },
      { to: '/mis-postulaciones', label: 'Mis postulaciones', icon: 'folder' },
      { to: '/perfil', label: 'Mi perfil', icon: 'user' },
      { to: '/documentos', label: 'Documentos', icon: 'folder' },
      { to: '/notificaciones', label: 'Notificaciones', icon: 'bell' },
    ];
  }

  // gestor_humano y admin comparten la base operativa
  const base: ItemMenu[] = [
    { to: '/gestion-humana', label: 'Procesos de Selección', icon: 'users' },
    { to: '/reportes', label: 'Reportes', icon: 'chart' },
  ];

  if (rol === 'admin') {
    base.unshift({ to: '/dashboard', label: 'Dashboard', icon: 'home' });
    base.push(
      { to: '/usuarios', label: 'Usuarios', icon: 'users' },
      { to: '/auditoria', label: 'Auditoría', icon: 'eye' },
      { label: 'Roles y permisos', icon: 'shield', proximamente: true },
      { label: 'Configuración', icon: 'settings', proximamente: true },
    );
  }

  base.push(
    { to: '/notificaciones', label: 'Notificaciones', icon: 'bell' },
    { to: '/perfil', label: 'Mi perfil', icon: 'user' },
  );
  return base;
}

const ETIQUETAS_ROL: Record<string, string> = { candidato: 'Candidato', gestor_humano: 'Gestión Humana', admin: 'Administrador' };

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, Icon],
  host: { style: 'display: contents' },
  template: `
    <!-- En móvil el menú arranca cerrado: este botón lo abre y el fondo lo cierra. -->
    @if (colapsado()) {
      <button type="button" class="sidebar-abrir" (click)="colapsado.set(false)" aria-label="Abrir menú" [attr.aria-expanded]="false">
        <app-icon name="menu" [size]="22" [strokeWidth]="2" />
      </button>
    } @else if (esMovil()) {
      <button type="button" class="sidebar-fondo" (click)="colapsado.set(true)" aria-label="Cerrar menú" tabindex="-1"></button>
    }
    <aside class="sidebar" [class.sidebar--colapsado]="colapsado()" aria-label="Menú principal" [attr.inert]="colapsado() && esMovil() ? '' : null">
      <div class="sidebar__brand">
        @if (!colapsado()) {
          <img src="assets/logo-aguas-nacionales.png" alt="Aguas Nacionales EPM" class="sidebar__logo" />
        }
        <button
          type="button"
          class="sidebar__toggle"
          (click)="colapsado.set(!colapsado())"
          [attr.aria-label]="colapsado() ? 'Expandir menú' : 'Colapsar menú'"
          [attr.aria-expanded]="!colapsado()"
        >
          <app-icon
            name="chevron"
            [size]="16"
            [strokeWidth]="2"
            [svgStyle]="{ transform: !colapsado() ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }"
          />
        </button>
      </div>

      <nav class="sidebar__nav">
        @for (item of items(); track $index) {
          @if (item.proximamente) {
            <span class="sidebar__item sidebar__item--disabled" title="Próximamente" aria-disabled="true">
              <app-icon [name]="item.icon" />
              @if (!colapsado()) {
                <span class="sidebar__item-label">{{ item.label }}</span>
                <span class="sidebar__soon">Pronto</span>
              }
            </span>
          } @else {
            <a
              [routerLink]="item.to"
              class="sidebar__item"
              [class.is-active]="pathname() === item.to"
              [attr.aria-current]="pathname() === item.to ? 'page' : null"
              [attr.aria-label]="colapsado() ? item.label : null"
              [title]="item.label"
              (click)="cerrarEnMovil()"
            >
              <app-icon [name]="item.icon" />
              @if (!colapsado()) {
                <span class="sidebar__item-label">{{ item.label }}</span>
              }
            </a>
          }
        }
      </nav>

      <div class="sidebar__footer">
        <!-- Foto (o iniciales) + nombre. Con el menú colapsado queda solo el avatar. -->
        <a
          routerLink="/perfil"
          class="sidebar__user"
          [class.sidebar__user--colapsado]="colapsado()"
          [attr.aria-label]="colapsado() ? 'Mi perfil: ' + (auth.usuario()?.nombreCompleto || '') : null"
          [title]="colapsado() ? (auth.usuario()?.nombreCompleto || 'Mi perfil') : ''"
          (click)="cerrarEnMovil()"
        >
          <span class="sidebar__avatar" aria-hidden="true">
            @if (foto.url()) {
              <img [src]="foto.url()" alt="" />
            } @else {
              {{ iniciales(auth.usuario()?.nombreCompleto) || '?' }}
            }
          </span>
          @if (!colapsado()) {
            <span class="sidebar__user-texto">
              <span class="sidebar__user-name">{{ auth.usuario()?.nombreCompleto }}</span>
              <span class="sidebar__user-rol">{{ etiquetaRol() }}</span>
            </span>
          }
        </a>
        <button type="button" class="sidebar__item sidebar__logout" (click)="handleLogout()" title="Cerrar sesión">
          <app-icon name="logout" />
          @if (!colapsado()) {
            <span class="sidebar__item-label">Cerrar sesión</span>
          }
        </button>
      </div>
    </aside>
  `,
})
export class Sidebar {
  protected readonly auth = inject(AuthService);
  protected readonly foto = inject(FotoPerfilService);
  protected readonly iniciales = iniciales;
  private readonly router = inject(Router);
  /** Pantallas pequeñas: el menú se abre por encima del contenido y arranca cerrado. */
  private readonly consultaMovil = window.matchMedia('(max-width: 720px)');
  protected readonly esMovil = signal(this.consultaMovil.matches);
  protected readonly colapsado = signal(this.consultaMovil.matches);
  protected readonly pathname = signal(this.router.url.split(/[?#]/)[0]);

  constructor() {
    this.consultaMovil.addEventListener('change', (e) => {
      this.esMovil.set(e.matches);
      this.colapsado.set(e.matches);
    });
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.pathname.set(this.router.url.split(/[?#]/)[0]));
  }

  protected cerrarEnMovil(): void {
    if (this.esMovil()) this.colapsado.set(true);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cerrarEnMovil();
  }

  protected items(): ItemMenu[] {
    return itemsPara(this.auth.usuario()?.rol);
  }

  protected etiquetaRol(): string {
    const rol = this.auth.usuario()?.rol;
    return ETIQUETAS_ROL[rol] || rol;
  }

  protected handleLogout(): void {
    this.cerrarEnMovil();
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
