# Solicitud de Inscripción a Proceso de Selección

Frontend en **React + Vite**, conectado a 3 microservicios backend (FastAPI):
**Login**, **Vacantes** y **Candidatos**. Ver el repositorio `recruitment-platform`
para el código de esos backends.

## Requisitos

- Node.js 18 o superior
- Los 3 backends corriendo (ver más abajo)

## Instalación y desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

### Levantar los 3 backends primero

```bash
# Terminal aparte, dentro de recruitment-platform/
cd modulo_login && uvicorn app.main:app --port 8000
cd modulo_vacantes && uvicorn app.main:app --port 8001
cd modulo_candidatos && VACANTES_SERVICE_URL=http://localhost:8001 uvicorn app.main:app --port 8002
```

Sin estos 3 backends corriendo, la app carga pero ninguna pantalla con datos funciona
(lista de vacantes, login, inscripción, panel de Gestión Humana).

## Compilar para producción

```bash
npm run build
```

⚠️ Configurar `VITE_LOGIN_API_URL`, `VITE_VACANTES_API_URL` y `VITE_CANDIDATOS_API_URL`
apuntando a las URLs reales de cada backend en producción (no `localhost`).

⚠️ Como usa rutas de React Router, el hosting debe redirigir cualquier ruta desconocida
a `index.html` ("SPA fallback").

## Cómo se conecta con los backends

```
src/lib/api/
├── config.js         → URLs base de los 3 servicios (variables VITE_*)
├── httpClient.js      → fetch genérico + manejo de errores (ApiError)
├── caseConverter.js    → conversión snake_case <-> camelCase (SOLO para Vacantes)
├── authApi.js          → registro, login, perfil
├── vacantesApi.js       → listar/crear/editar/ocultar/eliminar vacantes
└── solicitudesApi.js    → enviar solicitud, mis postulaciones, cambiar estado, descargar PDF

src/context/AuthContext.jsx  → sesión (token + usuario), persistida en localStorage
src/components/ProtectedRoute.jsx → protege rutas por autenticación/rol
```

### Una nota importante sobre nombres de campos

- **Vacantes**: el backend usa `snake_case` de punta a punta (incluidos los criterios
  anidados), así que `vacantesApi.js` convierte **todo el objeto** automáticamente con
  `caseConverter.js`. Los componentes (`VacanteForm`, etc.) siguen usando `camelCase`
  sin enterarse de la conversión.
- **Candidatos/Solicitudes**: el backend solo normaliza las llaves de **primer nivel**
  (`vacante_id`, `datos_personales`, etc.); el **contenido** de `datosPersonales`,
  `registrosII`, `experiencia`, etc. viaja tal cual en `camelCase`, porque la evaluación
  automática del backend ya espera esas llaves exactas (`nivelEducativo`, `fechaInicio`,
  `graduado`...). Por eso `solicitudesApi.js` mapea esas llaves a mano, sin conversión
  recursiva.

## Autenticación

- El candidato debe **crear cuenta o iniciar sesión** antes de postularse (`/registro`,
  `/login`). El registro público siempre crea un usuario `candidato` — no hay forma de
  auto-asignarse otro rol desde ahí.
- `/postularme/:id` y `/mis-postulaciones` requieren estar autenticado (cualquier rol).
- `/gestion-humana` requiere rol `gestor_humano` o `admin`.
- La sesión (token + datos del usuario) se guarda en `localStorage` bajo la llave
  `auth_session` y se restaura automáticamente al recargar la página.

## PDF y evaluación automática

Ya **no se generan en el navegador** — ambos viven en el backend (módulo Candidatos):
- El PDF se descarga desde `GET /api/v1/solicitudes/{radicado}/pdf`.
- La evaluación (`cumple`/`no cumple` + motivos) se calcula al momento de crear la
  solicitud, cruzando los criterios de la vacante (módulo Vacantes) por HTTP. Sigue
  siendo **solo informativa** — nunca bloquea el envío ni oculta candidatos a Gestión
  Humana.

## Pendiente para producción

- Reemplazar el logo placeholder (`DocHeader.jsx`) por el logo real.
- Validar el texto de las 9 cláusulas de la Hoja VIII con Legal/Gestión Humana.
- Configurar HTTPS y URLs reales de los 3 backends antes de desplegar.
