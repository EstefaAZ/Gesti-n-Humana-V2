# ==============================================================
# modulo_candidatos / app/services/perfil_candidato_service.py
# ==============================================================

from typing import Optional

from sqlalchemy.orm import Session

from app.models.perfil_candidato import PerfilCandidato
from app.schemas.perfil_candidato import PerfilCandidatoGuardar


class NombreNoCoincideError(Exception):
    """La autorización debe firmarse con el mismo nombre con el que el candidato se registró."""
    pass


def _normalizar_nombre(nombre: str) -> str:
    # Flexible: ignora mayúsculas/minúsculas y espacios de más (al inicio, al
    # final, y dobles espacios entre palabras) — pero el texto debe ser el mismo.
    return " ".join(nombre.strip().split()).lower()


def obtener_perfil(db: Session, usuario_id: str) -> Optional[PerfilCandidato]:
    return db.query(PerfilCandidato).filter(PerfilCandidato.usuario_id == usuario_id).first()


def obtener_estado_perfil(db: Session, usuario_id: str) -> dict:
    perfil = obtener_perfil(db, usuario_id)
    return {"existe": perfil is not None, "completado": bool(perfil and perfil.completado)}


def guardar_perfil(
    db: Session, usuario_id: str, datos: PerfilCandidatoGuardar, nombre_cuenta: str
) -> PerfilCandidato:
    """
    Crea o reemplaza el perfil del candidato. SIEMPRE valida que el nombre en
    autorizacion coincida (de forma flexible) con el nombre de la cuenta —
    nunca se puede completar el perfil ni guardar cambios con un nombre
    distinto al de la cuenta.
    """
    if _normalizar_nombre(datos.autorizacion.nombre_completo) != _normalizar_nombre(nombre_cuenta):
        raise NombreNoCoincideError(
            f'El nombre en Autorización debe ser el mismo con el que te registraste ("{nombre_cuenta}").'
        )

    perfil = obtener_perfil(db, usuario_id)
    if not perfil:
        perfil = PerfilCandidato(usuario_id=usuario_id)
        db.add(perfil)

    perfil.datos_personales = datos.datos_personales
    perfil.registros_ii = datos.registros_ii
    perfil.experiencia = datos.experiencia
    perfil.conflicto = datos.conflicto
    perfil.documentos_adjuntos = datos.documentos_adjuntos.model_dump()
    perfil.autorizacion = datos.autorizacion.model_dump()
    perfil.completado = True

    db.commit()
    db.refresh(perfil)
    return perfil
