import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Íconos SVG simples, sin dependencias externas (los mismos trazos que usaban
 * los componentes de React: Sidebar, páginas de autenticación y Mi perfil).
 */
const TRAZOS: Record<string, string> = {
  // ---- Sidebar ----
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10" />',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />',
  chart: '<path d="M3 3v18h18" /><path d="M7 13l3-3 3 3 5-6" />',
  shield: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />',
  settings: '<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.66.24 1.24.68 1.51 1.51H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" />',
  chevron: '<path d="M15 18l-6-6 6-6" />',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" />',

  // ---- Autenticación ----
  mail: '<rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />',
  idCard: '<rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8.5" cy="12" r="1.8" /><path d="M13.5 10h5M13.5 14h3.5" />',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7" />',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7" />',
  eyeOff: '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" />',
  check: '<path d="M20 6L9 17l-5-5" />',
  circle: '<circle cx="12" cy="12" r="9" />',
  lockBadge: '<rect x="4" y="11" width="16" height="9" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />',

  // ---- Mi perfil ----
  persona: '<circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />',
  escudo: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />',
  camara: '<path d="M4 8h3l2-2h6l2 2h3v11H4V8z" /><circle cx="12" cy="13.5" r="3.5" />',
  ojoTachado: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /><line x1="2" y1="22" x2="22" y2="2" />',
  cuentaX: '<circle cx="10" cy="8" r="4" /><path d="M2 21c0-4.4 3.6-7 8-7 1.7 0 3.2.4 4.5 1.1" /><line x1="16" y1="16" x2="22" y2="22" /><line x1="22" y1="16" x2="16" y2="22" />',
  papelera: '<path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" />',
  checkMini: '<polyline points="20 6 9 17 4 12" />',
  // ---- Pasos de Completar perfil / Postularme ----
  birrete: '<path d="M2 9l10-5 10 5-10 5-10-5z" /><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /><path d="M22 9v6" />',
  balanza: '<path d="M12 3v18M7 21h10M4 7h16" /><path d="M4 7l-2.5 6a3 3 0 0 0 5 0L4 7zM20 7l-2.5 6a3 3 0 0 0 5 0L20 7z" />',
  documento: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h4" />',
  mas: '<path d="M12 5v14M5 12h14" />',
  chevronAbajo: '<path d="M6 9l6 6 6-6" />',
  subir: '<path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />',
  firma: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" /><path d="M14 21h7" />',
};

@Component({
  selector: 'app-icon',
  host: { style: 'display: contents' },
  template: `
    <svg
      aria-hidden="true"
      focusable="false"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [style]="svgStyle()"
      [innerHTML]="trazos()"
    ></svg>
  `,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input<number>(18);
  readonly strokeWidth = input<number | string>(1.7);
  readonly svgStyle = input<any>(null);

  private readonly sanitizer = inject(DomSanitizer);
  // Los trazos son constantes de este mismo archivo (no vienen del usuario).
  protected readonly trazos = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(TRAZOS[this.name()] || ''));
}
