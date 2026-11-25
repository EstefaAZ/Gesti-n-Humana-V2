# ==============================================================
# modulo_candidatos / app/api/v1/catalogos.py
# Catálogo de Núcleos Básicos del Conocimiento (NBC) para el formulario de
# vacantes: listar los núcleos y sugerir los de un título escrito.
# ==============================================================

from fastapi import APIRouter, Depends, Query

from app.api.deps import requerir_roles, UsuarioToken
from app.services import nbc_catalogo

router = APIRouter(prefix="/catalogos", tags=["Catálogos"])

ROLES_GESTION = ("gestor_humano", "admin")


@router.get("/nbc")
def listar_nbc(_: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION))):
    """Núcleos Básicos del Conocimiento, agrupables por área."""
    return nbc_catalogo.listar_nucleos()


@router.get("/nbc/clasificar")
def clasificar_titulo(
    titulo: str = Query(..., min_length=1, max_length=200),
    _: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    """Núcleos a los que pertenece un título ("mecánica automotriz" -> 831)."""
    return {"codigos": nbc_catalogo.clasificar_titulo(titulo)}
