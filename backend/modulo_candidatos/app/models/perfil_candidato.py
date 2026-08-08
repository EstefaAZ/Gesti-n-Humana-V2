# ==============================================================
# modulo_candidatos / app/models/perfil_candidato.py
# Perfil del candidato (GTH-FOR-03 "base") — se llena UNA VEZ al registrarse
# y se reutiliza para postularse a cualquier vacante sin volver a
# diligenciar todo el formulario. Una fila por cuenta (usuario_id es la PK).
# ==============================================================

from datetime import datetime

from sqlalchemy import Column, String, Boolean, JSON, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class PerfilCandidato(Base):
    __tablename__ = "perfiles_candidatos"

    # Mismo id que la cuenta en el módulo Login — no hay FK real porque cada
    # módulo tiene su propia base de datos, igual que el resto del sistema.
    usuario_id = Column(String(36), primary_key=True)

    datos_personales = Column(JSON, nullable=False, default=dict)
    registros_ii = Column(JSON, default=list)
    experiencia = Column(JSON, default=list)
    conflicto = Column(JSON, default=dict)
    documentos_adjuntos = Column(JSON, default=dict)
    autorizacion = Column(JSON, default=dict)

    # Solo True cuando terminó el wizard completo. Antes de eso, un candidato
    # no puede usar el sitio (se le manda directo a terminarlo).
    completado = Column(Boolean, default=False, nullable=False)

    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), onupdate=func.now())
