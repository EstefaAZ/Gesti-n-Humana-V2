# ==============================================================
# modulo_vacantes / app/services/auditoria_service.py
# Registro de auditoría — SOLO para acciones relevantes de gobernanza
# (no cada micro-acción, para no volverlo ruidoso ni exponer de más).
# ==============================================================

from sqlalchemy.orm import Session

from app.models.evento_auditoria import EventoAuditoria


def registrar_evento(
    db: Session,
    tipo: str,
    descripcion: str,
    actor_id: str | None = None,
    actor_nombre: str | None = None,
    actor_rol: str | None = None,
    entidad_tipo: str | None = None,
    entidad_id: str | None = None,
) -> None:
    evento = EventoAuditoria(
        tipo=tipo,
        descripcion=descripcion,
        actor_id=actor_id,
        actor_nombre=actor_nombre,
        actor_rol=actor_rol,
        entidad_tipo=entidad_tipo,
        entidad_id=entidad_id,
    )
    db.add(evento)
    db.commit()


def listar_eventos(db: Session, limite: int = 100) -> list[EventoAuditoria]:
    return (
        db.query(EventoAuditoria)
        .order_by(EventoAuditoria.fecha.desc())
        .limit(limite)
        .all()
    )
