# ==============================================================
# modulo_vacantes / app/core/security.py
# Validación de JWT emitido por el módulo Login.
# Este servicio NO tiene acceso a la base de usuarios: confía en
# los claims del token (sub, rol, email, nombre).
# ==============================================================

from typing import Optional

import jwt
from jwt import PyJWTError

from app.core.config import settings


def decodificar_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except PyJWTError:
        return None
