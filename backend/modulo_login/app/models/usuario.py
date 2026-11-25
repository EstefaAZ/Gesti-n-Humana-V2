# ==============================================================
# modulo_login / app/models/usuario.py
# Modelo de datos — Usuario
# ==============================================================

import enum
import uuid

from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class RolUsuario(str, enum.Enum):
    candidato = "candidato"
    gestor_humano = "gestor_humano"
    admin = "admin"


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre_completo = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    rol = Column(Enum(RolUsuario), default=RolUsuario.candidato, nullable=False)
    cedula = Column(String(30), unique=True, index=True, nullable=True)
    activo = Column(Boolean, default=True, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    # "Olvidé mi contraseña" — token de un solo uso con expiración
    reset_token = Column(String(64), unique=True, index=True, nullable=True)
    reset_token_expira = Column(DateTime(timezone=True), nullable=True)

    # Foto de perfil (tabla aparte, ver models/foto_perfil.py). Se borra junto con el usuario.
    foto = relationship("FotoPerfil", uselist=False, cascade="all, delete-orphan", lazy="select")

    @property
    def tiene_foto(self) -> bool:
        return self.foto is not None


# Se importa aquí para que SQLAlchemy registre el modelo de la relación de arriba
# (y create_all cree la tabla) sin que nadie más tenga que acordarse de importarlo.
from app.models.foto_perfil import FotoPerfil  # noqa: E402,F401
