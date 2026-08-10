# ==============================================================
# modulo_candidatos / app/models/notificacion.py
# Notificaciones dentro del sitio (campanita). Dos tipos:
#  - Individuales: usuario_id lleno — para un candidato específico
#    (confirmación de inscripción, cambio de estado).
#  - De difusión: usuario_id vacío, para_gestion=True — visibles para
#    CUALQUIER cuenta gestor_humano/admin (nueva postulación recibida).
#    Se transmiten así (sin copiar una fila por cada persona de RRHH) para
#    no tener que consultar el módulo Login por la lista de cuentas cada vez.
# ==============================================================

import uuid

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class Notificacion(Base):
    __tablename__ = "notificaciones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    usuario_id = Column(String(36), nullable=True, index=True)
    para_gestion = Column(Boolean, default=False, nullable=False)
    tipo = Column(String(50), nullable=False)
    titulo = Column(String(200), nullable=False)
    mensaje = Column(String(500), nullable=False)
    entidad_tipo = Column(String(50), nullable=True)
    entidad_id = Column(String(50), nullable=True)  # ej. el radicado
    leida = Column(Boolean, default=False, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
