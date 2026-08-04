# ==============================================================
# modulo_vacantes / app/services/vacante_service.py
# Lógica de negocio — crear, listar, actualizar, eliminar vacantes
# ==============================================================

from datetime import datetime, date, time
from typing import Optional

from sqlalchemy.orm import Session

from app.models.vacante import Vacante, ESTADOS_VISIBLES_CANDIDATO
from app.schemas.vacante import VacanteCrear, VacanteActualizar, VacanteOut


class VacanteNoEncontradaError(Exception):
    pass


class DocumentoNoEncontradoError(Exception):
    pass


def esta_cerrada(vacante: Vacante) -> bool:
    if not vacante.fecha_cierre:
        return False
    try:
        hh, mm = (vacante.hora_cierre or "23:59").split(":")
        cierre = datetime.combine(vacante.fecha_cierre, time(int(hh), int(mm)))
    except (ValueError, AttributeError):
        cierre = datetime.combine(vacante.fecha_cierre, time(23, 59))
    return datetime.now() > cierre


def _a_out(vacante: Vacante) -> VacanteOut:
    out = VacanteOut.model_validate(vacante)
    out.esta_cerrada = esta_cerrada(vacante)
    out.tiene_documento_pdf = bool(vacante.documento_pdf)
    return out


def crear_vacante(db: Session, datos: VacanteCrear, usuario_id: str, usuario_nombre: str) -> VacanteOut:
    vacante = Vacante(
        **datos.model_dump(exclude={"criterios"}),
        criterios=datos.criterios.model_dump(),
        creada_por_id=usuario_id,
        creada_por_nombre=usuario_nombre,
    )
    db.add(vacante)
    db.commit()
    db.refresh(vacante)
    return _a_out(vacante)


def listar_vacantes(db: Session, solo_visibles: bool = False) -> list[VacanteOut]:
    query = db.query(Vacante)
    if solo_visibles:
        query = query.filter(Vacante.estado.in_(ESTADOS_VISIBLES_CANDIDATO))
    vacantes = query.order_by(Vacante.fecha_creacion.desc()).all()
    return [_a_out(v) for v in vacantes]


def obtener_vacante(db: Session, vacante_id: str) -> Optional[VacanteOut]:
    vacante = db.query(Vacante).filter(Vacante.id == vacante_id).first()
    return _a_out(vacante) if vacante else None


def _obtener_o_falla(db: Session, vacante_id: str) -> Vacante:
    vacante = db.query(Vacante).filter(Vacante.id == vacante_id).first()
    if not vacante:
        raise VacanteNoEncontradaError(f"No existe una vacante con id {vacante_id}.")
    return vacante


def actualizar_vacante(db: Session, vacante_id: str, datos: VacanteActualizar) -> VacanteOut:
    vacante = _obtener_o_falla(db, vacante_id)
    for campo, valor in datos.model_dump(exclude={"criterios"}).items():
        setattr(vacante, campo, valor)
    vacante.criterios = datos.criterios.model_dump()
    db.commit()
    db.refresh(vacante)
    return _a_out(vacante)


def cambiar_estado(db: Session, vacante_id: str, nuevo_estado: str) -> VacanteOut:
    vacante = _obtener_o_falla(db, vacante_id)
    vacante.estado = nuevo_estado
    db.commit()
    db.refresh(vacante)
    return _a_out(vacante)


def eliminar_vacante(db: Session, vacante_id: str) -> None:
    vacante = _obtener_o_falla(db, vacante_id)
    db.delete(vacante)
    db.commit()


def subir_documento_pdf(db: Session, vacante_id: str, contenido: bytes, nombre_archivo: str) -> VacanteOut:
    vacante = _obtener_o_falla(db, vacante_id)
    vacante.documento_pdf = contenido
    vacante.documento_pdf_nombre = nombre_archivo
    db.commit()
    db.refresh(vacante)
    return _a_out(vacante)


def obtener_documento_pdf(db: Session, vacante_id: str) -> tuple[bytes, str]:
    vacante = _obtener_o_falla(db, vacante_id)
    if not vacante.documento_pdf:
        raise DocumentoNoEncontradoError("Esta vacante no tiene un documento PDF adjunto.")
    return vacante.documento_pdf, vacante.documento_pdf_nombre or f"{vacante_id}.pdf"


def obtener_estadisticas(db: Session) -> dict:
    """Conteos reales para el Dashboard — activas = estado "publicada";
    abiertas/cerradas se calculan (dependen de la fecha de cierre vs ahora)."""
    todas = db.query(Vacante).all()
    activas = sum(1 for v in todas if v.estado == "publicada")
    abiertas = sum(1 for v in todas if not esta_cerrada(v))
    recientes = sorted(todas, key=lambda v: v.fecha_creacion or datetime.min, reverse=True)[:5]
    return {
        "total": len(todas),
        "activas": activas,
        "ocultas": len(todas) - activas,
        "abiertas": abiertas,
        "cerradas": len(todas) - abiertas,
        "recientes": [_a_out(v) for v in recientes],
    }
