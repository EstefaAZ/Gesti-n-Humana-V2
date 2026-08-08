# ==============================================================
# modulo_candidatos / app/schemas/perfil_candidato.py
# Esquemas Pydantic — perfil del candidato (se llena una vez al registrarse)
# ==============================================================

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.schemas.solicitud import DocumentosAdjuntos, DocumentosAdjuntosOut


class AutorizacionPerfil(BaseModel):
    acepta: bool = False
    nombre_completo: str = Field(min_length=1)


class PerfilCandidatoGuardar(BaseModel):
    """Lo que manda el candidato al terminar (o editar) su perfil."""
    datos_personales: dict[str, Any]
    registros_ii: list[dict[str, Any]] = Field(default_factory=list)
    experiencia: list[dict[str, Any]] = Field(default_factory=list)
    conflicto: dict[str, Any] = Field(default_factory=dict)
    documentos_adjuntos: DocumentosAdjuntos
    autorizacion: AutorizacionPerfil


class PerfilCandidatoOut(BaseModel):
    usuario_id: str
    datos_personales: dict[str, Any]
    registros_ii: list[dict[str, Any]]
    experiencia: list[dict[str, Any]]
    conflicto: dict[str, Any]
    documentos_adjuntos: DocumentosAdjuntosOut = Field(default_factory=DocumentosAdjuntosOut)
    autorizacion: dict[str, Any]
    completado: bool
    fecha_creacion: Optional[datetime] = None
    fecha_actualizacion: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EstadoPerfilOut(BaseModel):
    """Respuesta liviana para saber si hay que mandar al candidato a completar su perfil."""
    existe: bool
    completado: bool
