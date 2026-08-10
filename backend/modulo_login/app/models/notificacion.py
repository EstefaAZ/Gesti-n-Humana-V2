# ==============================================================
# modulo_login / app/models/notificacion.py
# Notificaciones dentro del sitio (campanita) — eventos de la propia cuenta
# (desactivación/reactivación). Las de postulaciones viven en Candidatos.
# ==============================================================

import uuid

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class Notificacion(Base):
    __tablename__ = "notificaciones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    usuario_id = Column(String(36), nullable=False, index=True)
    tipo = Column(String(50), nullable=False)  # ej. "cuenta_desactivada", "cuenta_reactivada"
    titulo = Column(String(200), nullable=False)
    mensaje = Column(String(500), nullable=False)
    leida = Column(Boolean, default=False, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
