# ==============================================================
# modulo_login / app/schemas/notificacion.py
# ==============================================================

from typing import Optional

from pydantic import BaseModel
from app.schemas.tipos import FechaUTC


class NotificacionOut(BaseModel):
    id: str
    tipo: str
    titulo: str
    mensaje: str
    leida: bool
    fecha_creacion: Optional[FechaUTC] = None

    model_config = {"from_attributes": True}


class ConteoNoLeidas(BaseModel):
    no_leidas: int
