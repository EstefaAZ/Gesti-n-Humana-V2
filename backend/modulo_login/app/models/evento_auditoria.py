# ==============================================================
# modulo_login / app/models/evento_auditoria.py
# ==============================================================

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime

from app.core.database import Base


class EventoAuditoria(Base):
    __tablename__ = "eventos_auditoria"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tipo = Column(String(50), nullable=False)  # ej. "usuario_registrado", "rol_cambiado"
    descripcion = Column(String(500), nullable=False)  # texto legible para humanos

    actor_id = Column(String(36), nullable=True)
    actor_nombre = Column(String(200), nullable=True)
    actor_rol = Column(String(30), nullable=True)

    entidad_tipo = Column(String(50), nullable=True)  # ej. "usuario"
    entidad_id = Column(String(36), nullable=True)

    # Se genera en Python (microsegundos) en vez de server_default=func.now() de
    # SQLite, que solo tiene resolución de 1 segundo — con eventos creados muy
    # rápido seguido (como en las pruebas), dos eventos podían "empatar" y quedar
    # en un orden ambiguo. Con datetime.now() cada evento tiene un instante único.
    fecha = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
