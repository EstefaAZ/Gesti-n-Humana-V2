# ==============================================================
# modulo_candidatos / app/api/v1/perfiles.py
# ==============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import requerir_roles, UsuarioToken
from app.schemas.perfil_candidato import PerfilCandidatoGuardar, PerfilCandidatoOut, EstadoPerfilOut
from app.services import perfil_candidato_service

router = APIRouter(prefix="/perfiles", tags=["Perfil de candidato"])


@router.get("/me/estado", response_model=EstadoPerfilOut)
def estado_de_mi_perfil(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles("candidato")),
):
    """Chequeo liviano: ¿existe el perfil? ¿está completado? Para decidir si mandar al candidato a llenarlo."""
    return perfil_candidato_service.obtener_estado_perfil(db, usuario.id)


@router.get("/me", response_model=PerfilCandidatoOut)
def obtener_mi_perfil(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles("candidato")),
):
    perfil = perfil_candidato_service.obtener_perfil(db, usuario.id)
    if not perfil:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todavía no has completado tu perfil.")
    return perfil


@router.put("/me", response_model=PerfilCandidatoOut)
def guardar_mi_perfil(
    datos: PerfilCandidatoGuardar,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles("candidato")),
):
    """Crea o reemplaza el perfil (al terminar el wizard, o al editarlo después)."""
    try:
        return perfil_candidato_service.guardar_perfil(db, usuario.id, datos, nombre_cuenta=usuario.nombre or "")
    except perfil_candidato_service.NombreNoCoincideError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
