# ==============================================================
# modulo_vacantes / app/schemas/vacante.py
# Esquemas Pydantic — validación de entrada/salida
# ==============================================================

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

EstadoVacante = Literal["borrador", "publicada", "en_proceso", "cerrada", "cancelada_desierta"]


class CriteriosEvaluacion(BaseModel):
    """
    Criterios de evaluación automática — SOLO INFORMATIVOS.
    Nunca deben usarse para bloquear el envío de una solicitud; el módulo
    Candidatos los usa únicamente para calcular una etiqueta orientativa.
    """
    nivel_educativo_min: str = ""
    graduado_requerido: bool = True
    profesion_keyword: str = ""
    experiencia_min_anios: Optional[float] = None
    idioma_requerido: str = ""
    idioma_habilidad: str = "habla"  # habla | lee | escribe
    idioma_nivel_min: str = "Regular"  # Regular | Bien | Muy bien
    certificaciones_keywords: list[str] = Field(default_factory=list)

    @field_validator("certificaciones_keywords")
    @classmethod
    def maximo_5_certificaciones(cls, v: list[str]) -> list[str]:
        limpias = [c.strip() for c in v if c and c.strip()]
        if len(limpias) > 5:
            raise ValueError("No se pueden pedir más de 5 certificaciones.")
        return limpias


class VacanteBase(BaseModel):
    proceso_no: str = Field(min_length=1, max_length=50)
    cargo: str = Field(min_length=1, max_length=200)
    descripcion: Optional[str] = None
    area: Optional[str] = None
    salario: Optional[str] = None
    tipo_vinculacion: Optional[str] = None
    sede: Optional[str] = None
    plazas: int = 1
    fecha_apertura: Optional[date] = None
    fecha_cierre: Optional[date] = None
    hora_cierre: str = "16:00"
    publico_objetivo: str = "Externo"
    conocimientos_complementarios: Optional[str] = None
    requisitos_obligatorios: Optional[str] = None
    estado: EstadoVacante = "publicada"
    criterios: CriteriosEvaluacion = Field(default_factory=CriteriosEvaluacion)


class VacanteCrear(VacanteBase):
    pass


class VacanteActualizar(VacanteBase):
    pass


class CambiarEstadoVacante(BaseModel):
    estado: EstadoVacante


class VacanteOut(VacanteBase):
    id: str
    esta_cerrada: bool = False
    aun_no_abre: bool = False
    tiene_documento_pdf: bool = False
    creada_por_nombre: Optional[str] = None
    fecha_creacion: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EstadisticasVacantes(BaseModel):
    total: int
    activas: int
    ocultas: int
    abiertas: int
    cerradas: int
    por_estado: dict[str, int]
    recientes: list[VacanteOut]


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
