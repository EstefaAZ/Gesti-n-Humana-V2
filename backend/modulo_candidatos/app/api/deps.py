# ==============================================================
# modulo_candidatos / app/api/deps.py
# Usuario actual a partir del JWT emitido por el módulo Login.
# ==============================================================

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from app.core.security import decodificar_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


class UsuarioToken(BaseModel):
    id: str
    rol: str
    email: str | None = None
    nombre: str | None = None


def obtener_usuario_actual(token: str = Depends(oauth2_scheme)) -> UsuarioToken:
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la sesión.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credenciales_invalidas

    payload = decodificar_access_token(token)
    if payload is None or "sub" not in payload:
        raise credenciales_invalidas

    return UsuarioToken(
        id=payload["sub"],
        rol=payload.get("rol", "candidato"),
        email=payload.get("email"),
        nombre=payload.get("nombre"),
    )


def requerir_roles(*roles_permitidos: str):
    """Fábrica de dependencias: requerir_roles('gestor_humano', 'admin')"""

    def dependencia(usuario: UsuarioToken = Depends(obtener_usuario_actual)) -> UsuarioToken:
        if usuario.rol not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para acceder a este recurso.",
            )
        return usuario

    return dependencia
