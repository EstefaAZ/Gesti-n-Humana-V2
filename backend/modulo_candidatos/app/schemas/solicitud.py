# ==============================================================
# modulo_candidatos / app/schemas/solicitud.py
# Esquemas Pydantic — validación de entrada/salida
#
# Nota: datos_personales / registros_ii / experiencia / conflicto / autorizacion
# se validan como estructuras libres (dict/list) porque el frontend (wizard de
# las Hojas I-VIII) ya hace la validación detallada campo por campo antes de
# enviar. Aquí solo se exige lo mínimo para poder evaluar y generar el PDF.
# ==============================================================

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_TAMANO_ARCHIVO_BYTES = 5 * 1024 * 1024  # 5 MB por archivo

ETIQUETAS_DOCUMENTOS = {
    "cedula": "la cédula",
    "certificados_laborales": "al menos un certificado laboral con funciones",
    "certificados_estudio": "al menos un certificado de estudio y/o curso",
    "tarjeta_profesional": "la tarjeta profesional",
}


class DocumentoAdjunto(BaseModel):
    nombre: str
    contenido_base64: str

    @field_validator("contenido_base64")
    @classmethod
    def tamano_maximo(cls, v: str) -> str:
        tamano_aprox_bytes = (len(v) * 3) / 4  # el base64 infla ~33% el tamaño real
        if tamano_aprox_bytes > MAX_TAMANO_ARCHIVO_BYTES:
            raise ValueError("Cada archivo no puede pesar más de 5 MB.")
        return v


class DocumentosExtra(BaseModel):
    """
    Igual que DocumentosAdjuntos pero SIN exigir mínimo por categoría — son
    certificaciones adicionales, opcionales, solo para una vacante puntual
    (se usan en /solicitudes/inscribirme, no reemplazan el perfil guardado).
    """
    cedula: list[DocumentoAdjunto] = Field(default_factory=list, max_length=1)
    certificados_laborales: list[DocumentoAdjunto] = Field(default_factory=list, max_length=10)
    certificados_estudio: list[DocumentoAdjunto] = Field(default_factory=list, max_length=10)
    tarjeta_profesional: list[DocumentoAdjunto] = Field(default_factory=list, max_length=3)


class InscribirmeConPerfil(BaseModel):
    """Inscribirse con un clic reutilizando el perfil ya guardado."""
    vacante_id: str
    documentos_extra: Optional[DocumentosExtra] = None


class DocumentosAdjuntos(BaseModel):
    """
    Documentos obligatorios de la inscripción — sin esto, no se puede enviar
    la solicitud. Límites: cédula (máx 1), certificados laborales (máx 10),
    certificados de estudio/cursos (máx 10), tarjeta profesional (máx 3).
    """
    cedula: list[DocumentoAdjunto] = Field(default_factory=list, max_length=1)
    certificados_laborales: list[DocumentoAdjunto] = Field(default_factory=list, max_length=10)
    certificados_estudio: list[DocumentoAdjunto] = Field(default_factory=list, max_length=10)
    tarjeta_profesional: list[DocumentoAdjunto] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def al_menos_uno_de_cada_categoria(self) -> "DocumentosAdjuntos":
        # OJO: esto tiene que ser un model_validator, no field_validator — en
        # Pydantic v2 los field_validator NO corren sobre un campo que quedó
        # en su valor por defecto (ej. si el cliente manda "documentos_adjuntos: {}"
        # sin ninguna de las 4 llaves). Con field_validator, eso se saltaba la
        # validación por completo y dejaba pasar solicitudes sin documentos —
        # lo encontramos con una prueba real contra el servidor, no con las
        # pruebas unitarias (que siempre mandaban listas vacías explícitas).
        faltantes = [
            ETIQUETAS_DOCUMENTOS[campo]
            for campo in ETIQUETAS_DOCUMENTOS
            if len(getattr(self, campo)) == 0
        ]
        if faltantes:
            raise ValueError(f"Debes adjuntar: {', '.join(faltantes)}.")
        return self


class DocumentoAdjuntoMeta(BaseModel):
    """Solo el nombre — la descarga real va por un endpoint aparte, para no
    inflar cada respuesta de listado con el contenido base64 de los archivos."""
    nombre: str


class DocumentosAdjuntosOut(BaseModel):
    cedula: list[DocumentoAdjuntoMeta] = Field(default_factory=list)
    certificados_laborales: list[DocumentoAdjuntoMeta] = Field(default_factory=list)
    certificados_estudio: list[DocumentoAdjuntoMeta] = Field(default_factory=list)
    tarjeta_profesional: list[DocumentoAdjuntoMeta] = Field(default_factory=list)


class DetalleCategoriaEvaluacion(BaseModel):
    cumple: Optional[bool] = None  # None = esta vacante no tiene ese criterio configurado
    motivo: Optional[str] = None


class DetalleEvaluacion(BaseModel):
    estudios: DetalleCategoriaEvaluacion = DetalleCategoriaEvaluacion()
    conocimientos: DetalleCategoriaEvaluacion = DetalleCategoriaEvaluacion()
    experiencia: DetalleCategoriaEvaluacion = DetalleCategoriaEvaluacion()


class EvaluacionOut(BaseModel):
    cumple: bool
    motivos: list[str] = []
    detalle: DetalleEvaluacion = DetalleEvaluacion()


class SolicitudCrear(BaseModel):
    vacante_id: str
    datos_personales: dict[str, Any]
    registros_ii: list[dict[str, Any]] = Field(default_factory=list)
    experiencia: list[dict[str, Any]] = Field(default_factory=list)
    conflicto: dict[str, Any] = Field(default_factory=dict)
    autorizacion: dict[str, Any]
    documentos_adjuntos: DocumentosAdjuntos


class CambiarEstado(BaseModel):
    estado: str


class SolicitudOut(BaseModel):
    radicado: str
    vacante_id: str
    usuario_id: str
    datos_personales: dict[str, Any]
    registros_ii: list[dict[str, Any]]
    experiencia: list[dict[str, Any]]
    conflicto: dict[str, Any]
    autorizacion: dict[str, Any]
    documentos_adjuntos: DocumentosAdjuntosOut = Field(default_factory=DocumentosAdjuntosOut)
    evaluacion: Optional[EvaluacionOut] = None
    estado: str
    historial_estados: list[dict[str, Any]]
    anonimizada: bool = False
    fecha_solicitud: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SolicitudResumen(BaseModel):
    """Versión ligera para listados (tabla de postulaciones de HR)."""
    radicado: str
    vacante_id: str
    usuario_id: str
    nombre_completo: Optional[str] = None
    correo: Optional[str] = None
    celular: Optional[str] = None
    estado: str
    evaluacion: Optional[EvaluacionOut] = None
    fecha_solicitud: Optional[datetime] = None


class PuntoMes(BaseModel):
    mes: str  # "YYYY-MM"
    total: int


class SolicitudActividadReciente(BaseModel):
    radicado: str
    vacante_id: str
    nombre_completo: Optional[str] = None
    estado: str
    fecha_solicitud: Optional[datetime] = None


class EstadisticasSolicitudes(BaseModel):
    total: int
    por_estado: dict[str, int]
    por_mes: list[PuntoMes]
    recientes: list[SolicitudActividadReciente]


class EventoAuditoriaOut(BaseModel):
    id: str
    tipo: str
    descripcion: str
    actor_nombre: Optional[str] = None
    actor_rol: Optional[str] = None
    entidad_tipo: Optional[str] = None
    entidad_id: Optional[str] = None
    fecha: Optional[datetime] = None

    model_config = {"from_attributes": True}
