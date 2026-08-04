# ==============================================================
# modulo_candidatos / tests/test_vacantes_client.py
# Prueba los reintentos ante fallas de red transitorias, sin mockear
# la función completa (para probar la lógica real de reintento).
# ==============================================================

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx
import pytest

from app.clients import vacantes_client


class _RespuestaFalsa:
    def __init__(self, status_code, data):
        self.status_code = status_code
        self._data = data

    def json(self):
        return self._data


def test_reintenta_ante_fallas_transitorias_y_al_final_tiene_exito(monkeypatch):
    llamadas = {"n": 0}

    def get_falso(self, url, headers=None):
        llamadas["n"] += 1
        if llamadas["n"] < 3:
            raise httpx.ConnectError("conexión rechazada (simulada)")
        return _RespuestaFalsa(200, {"id": "vac-1", "esta_cerrada": False})

    monkeypatch.setattr(httpx.Client, "get", get_falso)
    monkeypatch.setattr(vacantes_client.time, "sleep", lambda s: None)  # no esperar de verdad en la prueba

    resultado = vacantes_client.obtener_vacante("vac-1")
    assert resultado == {"id": "vac-1", "esta_cerrada": False}
    assert llamadas["n"] == 3  # 2 fallos + 1 éxito


def test_falla_definitivamente_tras_agotar_reintentos(monkeypatch):
    def get_falso(self, url, headers=None):
        raise httpx.ConnectTimeout("timeout (simulado)")

    monkeypatch.setattr(httpx.Client, "get", get_falso)
    monkeypatch.setattr(vacantes_client.time, "sleep", lambda s: None)

    with pytest.raises(vacantes_client.VacantesServiceError, match="tras 3 intentos"):
        vacantes_client.obtener_vacante("vac-1")


def test_no_reintenta_ante_un_404_legitimo(monkeypatch):
    llamadas = {"n": 0}

    def get_falso(self, url, headers=None):
        llamadas["n"] += 1
        return _RespuestaFalsa(404, {"detail": "no encontrada"})

    monkeypatch.setattr(httpx.Client, "get", get_falso)

    resultado = vacantes_client.obtener_vacante("no-existe")
    assert resultado is None
    assert llamadas["n"] == 1  # un 404 no es una falla transitoria, no se reintenta
