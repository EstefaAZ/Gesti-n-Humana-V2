# Módulo Vacantes — Plataforma de Selección Aguas Nacionales EPM

Gestión de convocatorias y sus criterios de evaluación automática (informativos).

```
app/
├── main.py
├── core/
│   ├── config.py       → variables de entorno
│   ├── database.py     → engine y sesión de SQLAlchemy
│   └── security.py     → SOLO valida el JWT de Login (no genera tokens aquí)
├── models/vacante.py    → modelo SQLAlchemy (tabla `vacantes`, criterios como JSON)
├── schemas/vacante.py   → validación de entrada/salida
├── services/vacante_service.py → lógica de negocio
└── api/
    ├── deps.py           → usuario actual desde el JWT + control de roles
    └── v1/vacantes.py     → rutas públicas y protegidas
```

## Cómo se relaciona con el módulo Login

Este servicio **no tiene su propia tabla de usuarios ni genera tokens.** Confía en el
JWT que el módulo Login ya emitió: lo decodifica con el mismo `SECRET_KEY`/`ALGORITHM`
y lee de ahí el `rol` para decidir si la petición puede administrar vacantes.

⚠️ El `SECRET_KEY` en `.env` de este módulo **debe ser idéntico** al de `modulo_login/.env`.

## Cómo correrlo localmente

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
```

## Endpoints

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/api/v1/vacantes` | Público | Lista solo vacantes activas |
| GET | `/api/v1/vacantes/{id}` | Público | Detalle de una vacante activa (404 si está oculta) |
| GET | `/api/v1/vacantes/admin/todas` | gestor_humano / admin | Lista todas, incluidas las ocultas |
| GET | `/api/v1/vacantes/admin/{id}` | gestor_humano / admin | Detalle de cualquier vacante |
| POST | `/api/v1/vacantes` | gestor_humano / admin | Crear vacante |
| PUT | `/api/v1/vacantes/{id}` | gestor_humano / admin | Editar vacante |
| PATCH | `/api/v1/vacantes/{id}/toggle-activa` | gestor_humano / admin | Ocultar/reactivar |
| DELETE | `/api/v1/vacantes/{id}` | gestor_humano / admin | Eliminar |

## Sobre los criterios de evaluación

Van dentro de la vacante como un objeto `criterios` (nivel educativo mínimo, experiencia
mínima, idioma requerido, etc.). **Son solo informativos** — el módulo Candidatos los usa
para calcular una etiqueta orientativa, nunca para bloquear ni ocultar una postulación.

## Pruebas

```bash
python3 -m pytest tests/ -v
```

12 pruebas: listado público, creación/edición/eliminación, control de roles (401 sin
token, 403 con rol candidato), visibilidad de vacantes ocultas, y detección de cierre
por fecha/hora.

## Pendiente para producción

- Configurar `DATABASE_URL` a PostgreSQL (compartiendo motor con los demás módulos, pero
  con sus propias tablas).
- Sincronizar `SECRET_KEY` con el módulo Login mediante un secreto compartido real
  (variable de entorno inyectada por el orquestador, no copiada a mano).
