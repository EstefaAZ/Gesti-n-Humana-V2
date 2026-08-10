# ==============================================================
# modulo_login / app/schemas/notificacion.py
# ==============================================================

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificacionOut(BaseModel):
    id: str
    tipo: str
    titulo: str
    mensaje: str
    leida: bool
    fecha_creacion: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ConteoNoLeidas(BaseModel):
    no_leidas: int
