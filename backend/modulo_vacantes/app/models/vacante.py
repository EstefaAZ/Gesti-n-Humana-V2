# ==============================================================
# modulo_vacantes / app/models/vacante.py
# Modelo de datos — Vacante (convocatoria)
# ==============================================================

import uuid

from sqlalchemy import Column, String, Integer, Date, Text, JSON, DateTime, LargeBinary
from sqlalchemy.sql import func

from app.core.database import Base

# Los únicos 5 estados válidos. "publicada" y "cerrada" son los ÚNICOS que un
# candidato puede llegar a ver — "borrador", "en_proceso" y "cancelada_desierta"
# quedan invisibles para candidatos, como si la vacante no existiera para ellos.
ESTADOS_VACANTE = ("borrador", "publicada", "en_proceso", "cerrada", "cancelada_desierta")
ESTADOS_VISIBLES_CANDIDATO = ("publicada", "cerrada")


def _criterios_por_defecto():
    return {
        "nivel_educativo_min": "",
        "graduado_requerido": True,
        "profesion_keyword": "",
        "experiencia_min_anios": None,
        "idioma_requerido": "",
        "idioma_habilidad": "habla",
        "idioma_nivel_min": "Regular",
        "certificaciones_keywords": [],
    }


class Vacante(Base):
    __tablename__ = "vacantes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    proceso_no = Column(String(50), nullable=False)
    cargo = Column(String(200), nullable=False)
    area = Column(String(200), nullable=True)
    salario = Column(String(100), nullable=True)
    tipo_vinculacion = Column(String(100), nullable=True)
    sede = Column(String(150), nullable=True)
    plazas = Column(Integer, default=1)

    fecha_apertura = Column(Date, nullable=True)
    fecha_cierre = Column(Date, nullable=True)
    hora_cierre = Column(String(5), default="16:00")  # "HH:MM" — más simple de manejar entre capas

    publico_objetivo = Column(String(20), default="Externo")  # Interno / Externo / Ambos
    conocimientos_complementarios = Column(Text, nullable=True)
    requisitos_obligatorios = Column(Text, nullable=True)

    estado = Column(String(30), default="publicada", nullable=False)

    criterios = Column(JSON, default=_criterios_por_defecto)

    # Formato oficial de la convocatoria (PDF), opcional. Se guarda en la BD
    # directamente (bytes) — no hay almacenamiento de archivos externo todavía;
    # es un punto pendiente conocido para cuando se defina esa infraestructura.
    documento_pdf = Column(LargeBinary, nullable=True)
    documento_pdf_nombre = Column(String(255), nullable=True)

    # Trazabilidad de quién la creó (id de usuario del módulo Login, sin FK real
    # porque cada módulo tiene su propia base de datos)
    creada_por_id = Column(String(36), nullable=True)
    creada_por_nombre = Column(String(200), nullable=True)

    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), onupdate=func.now())
