# ==============================================================
# modulo_login / app/models/usuario.py
# Modelo de datos — Usuario
# ==============================================================

import enum
import uuid

from sqlalchemy import Column, String, Boolean, DateTime, Enum
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
