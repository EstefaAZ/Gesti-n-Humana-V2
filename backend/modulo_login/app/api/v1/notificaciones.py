# ==============================================================
# modulo_login / app/api/v1/notificaciones.py
# ==============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import obtener_usuario_actual
from app.models.usuario import Usuario
from app.schemas.notificacion import NotificacionOut, ConteoNoLeidas
from app.services import notificacion_service

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@router.get("/me", response_model=list[NotificacionOut])
def mis_notificaciones(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obtener_usuario_actual),
):
    return notificacion_service.listar_mis_notificaciones(db, usuario.id)


@router.get("/me/conteo", response_model=ConteoNoLeidas)
def conteo_no_leidas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obtener_usuario_actual),
):
    return {"no_leidas": notificacion_service.contar_no_leidas(db, usuario.id)}


@router.patch("/{notificacion_id}/leida", response_model=NotificacionOut)
def marcar_leida(
    notificacion_id: str,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obtener_usuario_actual),
):
    try:
        return notificacion_service.marcar_leida(db, usuario.id, notificacion_id)
    except notificacion_service.NotificacionNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/me/marcar-todas-leidas")
def marcar_todas_leidas(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obtener_usuario_actual),
):
    actualizadas = notificacion_service.marcar_todas_leidas(db, usuario.id)
    return {"actualizadas": actualizadas}
