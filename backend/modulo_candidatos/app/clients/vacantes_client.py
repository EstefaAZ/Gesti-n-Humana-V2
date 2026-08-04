# ==============================================================
# modulo_candidatos / app/clients/vacantes_client.py
#
# Este módulo tiene su PROPIA base de datos y no comparte tablas con
# Vacantes. Para saber si una vacante existe, está cerrada, o cuáles
# son sus criterios de evaluación, le pregunta por HTTP.
# ==============================================================

import logging
import time
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

REINTENTOS = 3
ESPERA_ENTRE_REINTENTOS = (0.3, 0.8)  # segundos, backoff simple (no exponencial completo)


class VacantesServiceError(Exception):
    """El servicio de Vacantes no respondió tras varios intentos, o respondió con un error inesperado."""
    pass


def _get_con_reintentos(client: httpx.Client, url: str, headers: Optional[dict] = None) -> httpx.Response:
    """
    Reintenta solo ante fallas de RED transitorias (timeout, conexión rechazada).
    Un 404 o cualquier respuesta HTTP válida NO se reintenta — eso no es una falla
    transitoria, es una respuesta legítima del servicio.
    """
    ultimo_error = None
    for intento in range(1, REINTENTOS + 1):
        try:
            return client.get(url, headers=headers or {})
        except httpx.RequestError as e:
            ultimo_error = e
            if intento < REINTENTOS:
                espera = ESPERA_ENTRE_REINTENTOS[min(intento - 1, len(ESPERA_ENTRE_REINTENTOS) - 1)]
                logger.warning(f"Intento {intento}/{REINTENTOS} fallido llamando a Vacantes ({e}); reintentando en {espera}s")
                time.sleep(espera)
    raise VacantesServiceError(f"No se pudo contactar al módulo de Vacantes tras {REINTENTOS} intentos: {ultimo_error}")


def obtener_vacante(vacante_id: str, token: Optional[str] = None) -> Optional[dict]:
    """
    Devuelve el dict de la vacante (incluye `esta_cerrada` y `criterios`), o
    None si no existe / no está disponible públicamente.
    """
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    url = f"{settings.VACANTES_SERVICE_URL}/api/v1/vacantes/admin/{vacante_id}"

    with httpx.Client(timeout=5.0) as client:
        # Se usa la ruta admin para que Gestión Humana también pueda operar sobre
        # vacantes ocultas; si no hay token válido, se intenta la ruta pública.
        if token:
            r = _get_con_reintentos(client, url, headers)
            if r.status_code == 200:
                return r.json()
        r_publico = _get_con_reintentos(client, f"{settings.VACANTES_SERVICE_URL}/api/v1/vacantes/{vacante_id}")
        if r_publico.status_code == 200:
            return r_publico.json()
        return None
