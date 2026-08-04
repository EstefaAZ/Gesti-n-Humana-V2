# Módulo Candidatos — Plataforma de Selección Aguas Nacionales EPM

Recibe las solicitudes de inscripción (Hojas I-VIII), calcula la evaluación automática
(informativa) contra los criterios de la vacante, y genera el PDF final.

```
app/
├── main.py
├── core/           → config, BD, validación de JWT (igual patrón que los otros módulos)
├── clients/vacantes_client.py → llama por HTTP al módulo Vacantes (cada módulo tiene su propia BD)
├── models/solicitud.py         → tabla `solicitudes`
├── schemas/solicitud.py        → validación de entrada/salida
├── services/
│   ├── evaluacion_service.py    → evaluación automática, SOLO informativa
│   ├── solicitud_service.py     → crear, listar, cambiar estado
│   └── pdf_service.py           → genera el PDF con reportlab
└── api/
    ├── deps.py       → usuario actual desde el JWT + control de roles
    └── v1/solicitudes.py
```

## Cómo se relaciona con los otros módulos

- **Login**: valida el JWT igual que Vacantes (mismo `SECRET_KEY`). El candidato debe
  iniciar sesión antes de postularse — esto es un cambio respecto a la versión anterior
  en React, donde cualquiera podía enviar el formulario sin cuenta.
- **Vacantes**: antes de aceptar una solicitud, este módulo llama por HTTP a
  `GET /api/v1/vacantes/{id}` (o la ruta admin, si hay token) para: (1) confirmar que la
  vacante existe, (2) confirmar que no está cerrada, y (3) traer los `criterios` con los
  que se calcula la evaluación.

⚠️ `VACANTES_SERVICE_URL` y `SECRET_KEY` deben apuntar/coincidir correctamente con el
módulo Vacantes y Login respectivamente.

## Cómo correrlo localmente

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8002
```

Para probarlo de verdad necesitas los 3 módulos corriendo a la vez (Login en :8000,
Vacantes en :8001, Candidatos en :8002) — ver la prueba de integración en
`tests/test_solicitudes.py` para el flujo mockeado, o levantar los 3 servidores reales
como se hizo durante el desarrollo (documentado en el README general).

## Endpoints

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/api/v1/solicitudes` | Cualquier usuario autenticado | Enviar una solicitud para una vacante |
| GET | `/api/v1/solicitudes/mias` | Cualquier usuario autenticado | Mis propias solicitudes |
| GET | `/api/v1/solicitudes/{radicado}` | Dueño o gestor_humano/admin | Detalle de una solicitud |
| GET | `/api/v1/solicitudes/vacante/{vacante_id}` | gestor_humano/admin | Todas las postulaciones de una vacante |
| PATCH | `/api/v1/solicitudes/{radicado}/estado` | gestor_humano/admin | Cambiar el estado |
| GET | `/api/v1/solicitudes/{radicado}/pdf` | Dueño o gestor_humano/admin | Descargar el PDF |

## Reglas de negocio importantes

- **No se puede postular dos veces a la misma vacante** (mismo `usuario_id` +
  `vacante_id` → 409).
- **No se aceptan solicitudes a vacantes cerradas** (409) ni a vacantes inexistentes (404).
- **La evaluación automática nunca bloquea nada.** Se calcula y se guarda junto con la
  solicitud, pero el candidato siempre puede enviarla — es una etiqueta para que Gestión
  Humana priorice su revisión, no un filtro de acceso.

## Pruebas

```bash
python3 -m pytest tests/ -v
```

12 pruebas, con el módulo Vacantes **mockeado** (no hace falta tenerlo corriendo para
correr estas pruebas). Cubren: creación exitosa y con evaluación cumple/no cumple,
vacante cerrada o inexistente, doble postulación, control de acceso (dueño / ajeno /
gestor_humano) tanto en el detalle como en el PDF, listado por vacante restringido a
Gestión Humana, y cambio de estado con historial.

## Pendiente para producción

- Configurar `DATABASE_URL` a PostgreSQL.
- El campo `datos_personales`/`registros_ii`/etc. se acepta hoy en **snake_case**
  (`datos_personales`, `registros_ii`) para seguir la convención de Python/REST; el
  frontend React actual envía **camelCase** (`datosPersonales`, `registrosII`). Falta
  decidir si se agregan alias camelCase en los esquemas Pydantic o si se ajusta el
  frontend al conectar ambos — quedó pendiente a propósito para no adivinar la decisión.
- Reintentos/circuit breaker en `vacantes_client` si el módulo Vacantes no responde.
