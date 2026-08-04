# Plataforma de Selección — Aguas Nacionales EPM

Arquitectura por microservicios, inspirada en el proyecto de referencia (GranoVital IA):
cada módulo es un servicio independiente con su propio backend en capas (FastAPI +
SQLAlchemy), pero con **un solo frontend React unificado** (a diferencia de la referencia,
que le da un frontend separado a cada módulo) — para que el candidato tenga una sola
experiencia de sitio, no varias "apps" sueltas.

## Módulos planeados

| # | Módulo | Estado | Qué hace |
|---|---|---|---|
| 1 | **Login** | ✅ Construido y probado | Registro, login (JWT), perfil, roles (candidato / gestor_humano / admin) |
| 2 | **Vacantes** | ✅ Construido y probado | Gestión Humana crea/edita convocatorias y sus criterios de evaluación |
| 3 | **Candidatos** | ✅ Construido y probado | Formulario de inscripción, evaluación automática informativa, PDF |
| 4 | **Reportes** | ⏳ Siguiente | Estadísticas de procesos (postulaciones por vacante, cumplimiento de criterios, tiempos) |
| 5 | **Notificaciones** | ⏳ Pendiente | Correos al candidato (confirmación de inscripción, cambios de estado) |

Construimos un módulo a la vez — cada uno con sus propias pruebas automatizadas antes de
pasar al siguiente, en vez de entregar todo junto sin verificar.

## Base de datos

**Recomendada: PostgreSQL.** El módulo Login corre hoy sobre SQLite solo para desarrollo
local sin instalar nada adicional; el código ya está preparado para apuntar a PostgreSQL
solo cambiando `DATABASE_URL` en el `.env` (ver `modulo_login/.env.example`).

## Estructura

```
recruitment-platform/
├── database/              → scripts SQL compartidos (se llenará más adelante)
├── modulo_login/           → ✅ construido
├── modulo_vacantes/         → ✅ construido
├── modulo_candidatos/       → ✅ construido
├── modulo_reportes/         → (siguiente)
├── modulo_notificaciones/   → (pendiente)
└── docker-compose.yml       → (pendiente — lo vemos después del código de los módulos)
```

## Cómo probar los 3 módulos juntos (sin Docker todavía)

```bash
# Terminal 1
cd modulo_login && uvicorn app.main:app --port 8000

# Terminal 2
cd modulo_vacantes && uvicorn app.main:app --port 8001

# Terminal 3
cd modulo_candidatos && VACANTES_SERVICE_URL=http://localhost:8001 uvicorn app.main:app --port 8002
```

Flujo real de prueba: `scripts/crear_admin.py` (Login) → admin crea un `gestor_humano`
vía `/usuarios-internos` → el gestor crea una vacante en Vacantes → un candidato se
registra y hace login en Login → el candidato envía una solicitud a Candidatos, que
consulta a Vacantes por HTTP para validar y evaluar → el gestor ve la postulación y
descarga el PDF. Este flujo completo ya se probó de extremo a extremo con los 3
servidores reales corriendo a la vez (no solo con mocks).

## Cómo correr lo que ya existe

Ver `modulo_login/README.md` para instrucciones detalladas de ese módulo.

## Decisiones tomadas hasta ahora

- **PostgreSQL** como motor de base de datos (recomendado por Claude, aprobado).
- **Un solo frontend** React unificado en vez de un frontend por módulo.
- **Docker se construye después** de tener el código de los módulos funcionando.
- Los criterios de evaluación automática del módulo Candidatos son **solo informativos**:
  nunca bloquean el envío de una solicitud ni ocultan candidatos a Gestión Humana.
