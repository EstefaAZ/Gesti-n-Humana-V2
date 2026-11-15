# Solicitud de Inscripción a Proceso de Selección — Frontend Angular

Frontend en **Angular 22** (componentes standalone + signals), conectado a los 3
microservicios backend (FastAPI): **Login**, **Vacantes** y **Candidatos**.

Es la migración 1:1 del frontend React + Vite (`../frontend`): mismas rutas, mismas
pantallas, mismos botones y mismas llamadas a la API. Los estilos (`tokens.css` y
`global.css`) se copiaron sin cambios.

## Requisitos

- Node.js 20.19 o superior (recomendado 22 LTS)
- Los 3 backends corriendo (ver más abajo)

## Instalación y desarrollo local

```bash
npm install
npm start          # = ng serve, en http://localhost:5173
```

El servidor de desarrollo usa el **puerto 5173** (el mismo de Vite) porque es el
origen que los backends tienen permitido en `ALLOWED_ORIGINS` (CORS).

### Levantar los 3 backends primero

```bash
cd backend/modulo_login      && uvicorn app.main:app --port 9000
cd backend/modulo_vacantes   && uvicorn app.main:app --port 9001
cd backend/modulo_candidatos && uvicorn app.main:app --port 9002
```

## URLs de los backends

Reemplazan a las variables `VITE_*` del `.env.local`:

| Archivo | Se usa en |
|---|---|
| `src/environments/environment.development.ts` | `npm start` / `ng serve` |
| `src/environments/environment.ts` | `npm run build` (producción) |

Antes de desplegar, cambia en `environment.ts` las URLs por las reales de cada
backend (no `localhost`).

## Compilar para producción

```bash
npm run build      # salida en dist/frontend-angular/browser
```

Como es una SPA con rutas, el servidor web debe redirigir cualquier ruta
desconocida a `index.html` (igual que con el build de Vite).

## Estructura

```
src/app/
  app.ts, app.routes.ts, app.config.ts   ← shell con sidebar + rutas (antes App.jsx)
  core/        auth.service.ts (antes AuthContext), auth.guard.ts (antes ProtectedRoute)
  lib/         api/* (fetch a los backends, igual que antes), formState, wizard, formato…
  data/        catálogos, países, municipios DIVIPOLA
  shared/      íconos SVG y directiva de autofocus
  components/  DocHeader, Sidebar, campanita, SelectConOtro, hojas del formulario, gráficos…
  pages/       páginas del candidato, autenticación y pages/hr (Gestión Humana / admin)
```

Los gráficos del Dashboard (antes Recharts) son componentes SVG propios
(`components/charts`), sin dependencias externas.
