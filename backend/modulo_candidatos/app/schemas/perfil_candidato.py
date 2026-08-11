# ==============================================================
# modulo_candidatos / app/schemas/perfil_candidato.py
# Esquemas Pydantic — perfil del candidato (se llena una vez al registrarse)
# ==============================================================

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.solicitud import (
    MAX_TAMANO_ARCHIVO_BYTES,
    ETIQUETAS_DOCUMENTOS,
    DocumentosAdjuntosOut,
)


class AutorizacionPerfil(BaseModel):
    acepta: bool = False
    nombre_completo: str = Field(min_length=1)


class DocumentoAdjuntoPerfil(BaseModel):
    """
    Igual que DocumentoAdjunto (en solicitud.py), pero contenido_base64 es
    OPCIONAL: cuando el candidato reutiliza un documento que ya subió antes
    (el frontend solo conoce su nombre, porque el backend nunca reenvía el
    base64 en las respuestas de /me o /me/borrador — sería muy pesado), lo
    manda sin contenido y el backend lo completa con lo que ya tiene
    guardado, emparejando por nombre dentro de la misma categoría.
    """
    nombre: str
    contenido_base64: Optional[str] = None

    @field_validator("contenido_base64")
    @classmethod
    def tamano_maximo(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        tamano_aprox_bytes = (len(v) * 3) / 4  # el base64 infla ~33% el tamaño real
        if tamano_aprox_bytes > MAX_TAMANO_ARCHIVO_BYTES:
            raise ValueError("Cada archivo no puede pesar más de 5 MB.")
        return v


class DocumentosAdjuntosPerfil(BaseModel):
    """
    Documentos obligatorios para completar el perfil. Cada documento puede
    venir con contenido_base64 (archivo nuevo) o solo con nombre (archivo
    que ya se subió antes y se está reutilizando).
    """
    cedula: list[DocumentoAdjuntoPerfil] = Field(default_factory=list, max_length=1)
    certificados_laborales: list[DocumentoAdjuntoPerfil] = Field(default_factory=list, max_length=10)
    certificados_estudio: list[DocumentoAdjuntoPerfil] = Field(default_factory=list, max_length=10)
    tarjeta_profesional: list[DocumentoAdjuntoPerfil] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def al_menos_uno_de_cada_categoria(self) -> "DocumentosAdjuntosPerfil":
        # OJO: tiene que ser model_validator, no field_validator — en Pydantic
        # v2 los field_validator no corren sobre un campo que quedó en su
        # valor por defecto (ej. "documentos_adjuntos: {}" sin ninguna llave).
        faltantes = [
            ETIQUETAS_DOCUMENTOS[campo]
            for campo in ETIQUETAS_DOCUMENTOS
            if len(getattr(self, campo)) == 0
        ]
        if faltantes:
            raise ValueError(f"Debes adjuntar: {', '.join(faltantes)}.")
        return self


class PerfilCandidatoGuardar(BaseModel):
    """Lo que manda el candidato al terminar (o editar) su perfil — con TODAS las validaciones."""
    datos_personales: dict[str, Any]
    registros_ii: list[dict[str, Any]] = Field(default_factory=list)
    experiencia: list[dict[str, Any]] = Field(default_factory=list)
    conflicto: dict[str, Any] = Field(default_factory=dict)
    documentos_adjuntos: DocumentosAdjuntosPerfil
    autorizacion: AutorizacionPerfil


class PerfilCandidatoBorrador(BaseModel):
    """
    Guardado automático MIENTRAS el candidato avanza por el wizard — a
    propósito, sin ninguna validación estricta (puede venir vacío, a medias,
    sin documentos, sin autorización). Nunca marca el perfil como completado;
    solo PerfilCandidatoGuardar (el envío final) puede hacer eso.
    """
    datos_personales: dict[str, Any] = Field(default_factory=dict)
    registros_ii: list[dict[str, Any]] = Field(default_factory=list)
    experiencia: list[dict[str, Any]] = Field(default_factory=list)
    conflicto: dict[str, Any] = Field(default_factory=dict)
    documentos_adjuntos: dict[str, Any] = Field(default_factory=dict)
    autorizacion: dict[str, Any] = Field(default_factory=dict)


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