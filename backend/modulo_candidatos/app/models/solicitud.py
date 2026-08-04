# ==============================================================
# modulo_candidatos / app/models/solicitud.py
# Modelo de datos — Solicitud de inscripción (GTH-FOR-03)
# ==============================================================

import random
from datetime import datetime

from sqlalchemy import Column, String, Boolean, JSON, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


def _generar_radicado() -> str:
    year = datetime.now().year
    return f"SOL-{year}-{random.randint(10000, 99999)}"


class Solicitud(Base):
    __tablename__ = "solicitudes"

    radicado = Column(String(20), primary_key=True, default=_generar_radicado)

    vacante_id = Column(String(36), nullable=False, index=True)
    usuario_id = Column(String(36), nullable=False, index=True)

    datos_personales = Column(JSON, nullable=False)
    registros_ii = Column(JSON, default=list)
    experiencia = Column(JSON, default=list)
    conflicto = Column(JSON, default=dict)
    autorizacion = Column(JSON, default=dict)

    # Documentos obligatorios (Ley 2039 de 2020 / requisitos del cargo):
    # cédula (máx 1), certificados laborales (máx 10), certificados de
    # estudio/cursos (máx 10), tarjeta profesional (máx 3). Se guardan en la
    # BD como base64 — no hay almacenamiento externo de archivos todavía,
    # es un punto pendiente conocido para producción con volumen real.
    documentos_adjuntos = Column(JSON, default=dict)

    # Evaluación automática — SOLO INFORMATIVA (ver services/evaluacion_service.py)
    evaluacion = Column(JSON, default=dict)

    estado = Column(String(50), default="Recibida", nullable=False)
    historial_estados = Column(JSON, default=list)

    # Habeas data (Ley 1581 de 2012): retención/anonimización — ver services/retencion_service.py
    anonimizada = Column(Boolean, default=False, nullable=False)
    fecha_anonimizacion = Column(DateTime(timezone=True), nullable=True)

    fecha_solicitud = Column(DateTime(timezone=True), server_default=func.now())
