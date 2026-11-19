# ==============================================================
# app/schemas/tipos.py
# Tipos compartidos por los esquemas de salida de la API.
# ==============================================================

from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator


def _como_utc(valor: datetime) -> datetime:
    # La base guarda las fechas en UTC, pero SQLite las devuelve sin zona horaria.
    # Sin la zona, el JSON sale como "2026-11-18T19:37:00" y el navegador la toma
    # como hora local (5 horas corrida en Colombia, y a veces del día siguiente).
    # Con ella sale "2026-11-18T19:37:00Z" y cada cliente la muestra en su hora.
    return valor.replace(tzinfo=timezone.utc) if valor.tzinfo is None else valor


FechaUTC = Annotated[datetime, AfterValidator(_como_utc)]
