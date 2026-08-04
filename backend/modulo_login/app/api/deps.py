# ==============================================================
# modulo_login / app/api/deps.py
# Dependencias compartidas: usuario actual desde el token, control de roles
# ==============================================================

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decodificar_access_token
from app.models.usuario import Usuario, RolUsuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def obtener_usuario_actual(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Usuario:
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la sesión.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decodificar_access_token(token)
    if payload is None:
        raise credenciales_invalidas

    usuario_id = payload.get("sub")
    if usuario_id is None:
        raise credenciales_invalidas

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if usuario is None or not usuario.activo:
        raise credenciales_invalidas
    return usuario


def requerir_roles(*roles_permitidos: RolUsuario):
    """Fábrica de dependencias: requerir_roles(RolUsuario.gestor_humano, RolUsuario.admin)"""

    def dependencia(usuario: Usuario = Depends(obtener_usuario_actual)) -> Usuario:
        if usuario.rol not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para acceder a este recurso.",
            )
        return usuario

    return dependencia
