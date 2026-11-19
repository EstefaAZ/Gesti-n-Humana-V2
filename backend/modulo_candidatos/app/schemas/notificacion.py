# ==============================================================
# modulo_candidatos / app/schemas/notificacion.py
# ==============================================================

from typing import Optional

from pydantic import BaseModel
from app.schemas.tipos import FechaUTC


class NotificacionOut(BaseModel):
    id: str
    tipo: str
    titulo: str
    mensaje: str
    entidad_tipo: Optional[str] = None
    entidad_id: Optional[str] = None
    leida: bool
    fecha_creacion: Optional[FechaUTC] = None

    model_config = {"from_attributes": True}


class ConteoNoLeidas(BaseModel):
    no_leidas: int
