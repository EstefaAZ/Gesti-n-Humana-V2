# ==============================================================
# modulo_candidatos / app/api/v1/notificaciones.py
# El mismo endpoint "/me" sirve tanto a candidatos (sus notificaciones
# individuales) como a Gestión Humana/admin (las de difusión) — se resuelve
# según el rol del token, para que el frontend no tenga que saber cuál usar.
# ==============================================================

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import obtener_usuario_actual, UsuarioToken
from app.core.database import get_db
from app.schemas.notificacion import NotificacionOut, ConteoNoLeidas
from app.services import notificacion_service
from sqlalchemy.orm import Session

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])

ROLES_GESTION = ("gestor_humano", "admin")


@router.get("/me", response_model=list[NotificacionOut])
def mis_notificaciones(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
):
    if usuario.rol in ROLES_GESTION:
        return notificacion_service.listar_notificaciones_gestion(db)
    return notificacion_service.listar_mis_notificaciones(db, usuario.id)


@router.get("/me/conteo", response_model=ConteoNoLeidas)
def conteo_no_leidas(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
):
    if usuario.rol in ROLES_GESTION:
        return {"no_leidas": notificacion_service.contar_no_leidas_gestion(db)}
    return {"no_leidas": notificacion_service.contar_no_leidas_candidato(db, usuario.id)}


@router.patch("/{notificacion_id}/leida", response_model=NotificacionOut)
def marcar_leida(
    notificacion_id: str,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
):
    try:
        return notificacion_service.marcar_leida(db, usuario.id, usuario.rol in ROLES_GESTION, notificacion_id)
    except notificacion_service.NotificacionNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/me/marcar-todas-leidas")
def marcar_todas_leidas(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
):
    if usuario.rol in ROLES_GESTION:
        actualizadas = notificacion_service.marcar_todas_leidas_gestion(db)
    else:
        actualizadas = notificacion_service.marcar_todas_leidas_candidato(db, usuario.id)
    return {"actualizadas": actualizadas}
