# ==============================================================
# modulo_login / app/services/notificacion_service.py
# ==============================================================

from sqlalchemy.orm import Session

from app.models.notificacion import Notificacion


def crear_notificacion(db: Session, usuario_id: str, tipo: str, titulo: str, mensaje: str) -> Notificacion:
    notif = Notificacion(usuario_id=usuario_id, tipo=tipo, titulo=titulo, mensaje=mensaje)
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


def contar_no_leidas(db: Session, usuario_id: str) -> int:
    return (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == usuario_id, Notificacion.leida.is_(False))
        .count()
    )


class NotificacionNoEncontradaError(Exception):
    pass


def marcar_leida(db: Session, usuario_id: str, notificacion_id: str) -> Notificacion:
    notif = (
        db.query(Notificacion)
        .filter(Notificacion.id == notificacion_id, Notificacion.usuario_id == usuario_id)
        .first()
    )
    if not notif:
        raise NotificacionNoEncontradaError("No existe esa notificación.")
    notif.leida = True
    db.commit()
    db.refresh(notif)
    return notif


def marcar_todas_leidas(db: Session, usuario_id: str) -> int:
    actualizadas = (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == usuario_id, Notificacion.leida.is_(False))
        .update({"leida": True})
    )
    db.commit()
    return actualizadas
