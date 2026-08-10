# ==============================================================
# modulo_candidatos / app/services/notificacion_service.py
# ==============================================================

from sqlalchemy.orm import Session

from app.models.notificacion import Notificacion


def crear_notificacion_candidato(
    db: Session, usuario_id: str, tipo: str, titulo: str, mensaje: str,
    entidad_tipo: str = None, entidad_id: str = None,
) -> Notificacion:
    notif = Notificacion(
        usuario_id=usuario_id, para_gestion=False, tipo=tipo, titulo=titulo, mensaje=mensaje,
        entidad_tipo=entidad_tipo, entidad_id=entidad_id,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def crear_notificacion_gestion(
    db: Session, tipo: str, titulo: str, mensaje: str,
    entidad_tipo: str = None, entidad_id: str = None,
) -> Notificacion:
    """Una sola fila, visible para CUALQUIER cuenta gestor_humano/admin (ver nota en el modelo)."""
    notif = Notificacion(
        usuario_id=None, para_gestion=True, tipo=tipo, titulo=titulo, mensaje=mensaje,
        entidad_tipo=entidad_tipo, entidad_id=entidad_id,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def listar_mis_notificaciones(db: Session, usuario_id: str, limite: int = 30) -> list[Notificacion]:
    return (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == usuario_id)
        .order_by(Notificacion.fecha_creacion.desc())
        .limit(limite)
        .all()
    )


def listar_notificaciones_gestion(db: Session, limite: int = 30) -> list[Notificacion]:
    return (
        db.query(Notificacion)
        .filter(Notificacion.para_gestion.is_(True))
        .order_by(Notificacion.fecha_creacion.desc())
        .limit(limite)
        .all()
    )


def contar_no_leidas_candidato(db: Session, usuario_id: str) -> int:
    return db.query(Notificacion).filter(Notificacion.usuario_id == usuario_id, Notificacion.leida.is_(False)).count()


def contar_no_leidas_gestion(db: Session) -> int:
    return db.query(Notificacion).filter(Notificacion.para_gestion.is_(True), Notificacion.leida.is_(False)).count()


class NotificacionNoEncontradaError(Exception):
    pass


def marcar_leida(db: Session, usuario_id: str, es_gestion: bool, notificacion_id: str) -> Notificacion:
    query = db.query(Notificacion).filter(Notificacion.id == notificacion_id)
    if es_gestion:
        query = query.filter(Notificacion.para_gestion.is_(True))
    else:
        query = query.filter(Notificacion.usuario_id == usuario_id)
    notif = query.first()
    if not notif:
        raise NotificacionNoEncontradaError("No existe esa notificación.")
    notif.leida = True
    db.commit()
    db.refresh(notif)
    return notif


def marcar_todas_leidas_candidato(db: Session, usuario_id: str) -> int:
    actualizadas = (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == usuario_id, Notificacion.leida.is_(False))
        .update({"leida": True})
    )
    db.commit()
    return actualizadas


def marcar_todas_leidas_gestion(db: Session) -> int:
    actualizadas = (
        db.query(Notificacion)
        .filter(Notificacion.para_gestion.is_(True), Notificacion.leida.is_(False))
        .update({"leida": True})
    )
    db.commit()
    return actualizadas
