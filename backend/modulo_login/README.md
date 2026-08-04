# Módulo Login — Plataforma de Selección Aguas Nacionales EPM

Módulo de autenticación. Arquitectura en capas (mismo patrón que el resto de los módulos):

```
app/
├── main.py            → punto de entrada, monta el router y el CORS
├── core/
│   ├── config.py       → variables de entorno (Settings)
│   ├── database.py     → engine y sesión de SQLAlchemy
│   └── security.py     → hashing de contraseñas (bcrypt) y JWT
├── models/usuario.py   → modelo SQLAlchemy (tabla `usuarios`)
├── schemas/usuario.py  → validación de entrada/salida (Pydantic)
├── services/auth_service.py → lógica de negocio (registro, login)
└── api/
    ├── deps.py          → dependencias compartidas (usuario actual, control de roles)
    └── v1/auth.py        → rutas: /registro, /login, /me
```

## Cómo correrlo localmente (sin Docker, con SQLite)

```bash
python3 -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Documentación interactiva: http://localhost:8000/docs

## Endpoints

| Método | Ruta | Descripción | Requiere token |
|---|---|---|---|
| POST | `/api/v1/auth/registro` | Registro público — **siempre** crea un candidato, sin excepción | No |
| POST | `/api/v1/auth/login` | Iniciar sesión, devuelve un JWT | No |
| GET | `/api/v1/auth/me` | Perfil del usuario autenticado | Sí |
| POST | `/api/v1/auth/usuarios-internos` | Crear una cuenta `gestor_humano` o `admin` | Sí (solo `admin`) |

## Roles y quién puede crear qué

- **`candidato`**: se autoregistra libremente en `/registro`. Ese endpoint no acepta ni
  lee ningún campo de rol — sin importar qué envíe alguien en el cuerpo de la petición,
  siempre queda como candidato.
- **`gestor_humano` / `admin`**: solo se crean desde `/usuarios-internos`, que exige que
  quien llama ya sea `admin`. No hay ninguna otra vía en la API para obtener estos roles.

### ¿Y el primer admin? (arranque)

Como crear un admin requiere ya ser admin, el primero se crea con un script que se corre
una sola vez a mano en el servidor — nunca por HTTP:

```bash
python3 scripts/crear_admin.py --nombre "Ana Ruiz" --email ana@aguasnacionales.com --password "ClaveSegura123"
```

Ese admin luego usa `/usuarios-internos` para crear las cuentas de `gestor_humano` que
necesite el equipo.

## Pruebas

```bash
python3 -m pytest tests/ -v
```

13 pruebas cubren: registro exitoso, email duplicado, validación de contraseña,
**intento de autoasignarse rol admin (bloqueado)**, login exitoso + token válido para
`/me`, login con contraseña incorrecta, acceso sin token, y el flujo completo de
`/usuarios-internos` (rechazo sin token, rechazo con rol candidato, creación exitosa
por un admin, rechazo si se intenta crear con rol candidato por esa vía).

## Pendiente para producción

- Cambiar `SECRET_KEY` por un valor aleatorio real (no el del `.env.example`).
- Configurar `DATABASE_URL` apuntando a PostgreSQL.
- Revisar expiración de tokens y agregar refresh tokens si se necesita sesión larga.
- Correr `scripts/crear_admin.py` una sola vez en el despliegue inicial para tener el
  primer admin; después, todo se gestiona desde `/usuarios-internos`.
