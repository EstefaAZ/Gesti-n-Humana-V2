# ==============================================================
# modulo_candidatos / tests/test_notificaciones.py
# ==============================================================

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from tests.conftest import client
from tests.test_solicitudes import HEADERS_CANDIDATO, HEADERS_OTRO_CANDIDATO, HEADERS_GESTOR, HEADERS_ADMIN, SOLICITUD_VALIDA

pytestmark = pytest.mark.usefixtures("mock_vacantes")


def test_candidato_no_tiene_notificaciones_al_principio():
    r = client.get("/api/v1/notificaciones/me", headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.json() == []


def test_inscribirse_genera_notificacion_de_confirmacion_para_el_candidato():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/notificaciones/me", headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["tipo"] == "solicitud_creada"


def test_inscribirse_genera_notificacion_de_difusion_para_gestion():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)

    r_gestor = client.get("/api/v1/notificaciones/me", headers=HEADERS_GESTOR)
    tipos_gestor = [n["tipo"] for n in r_gestor.json()]
    assert "nueva_postulacion" in tipos_gestor

    # También la ve admin — es de difusión, no de una cuenta puntual.
    r_admin = client.get("/api/v1/notificaciones/me", headers=HEADERS_ADMIN)
    tipos_admin = [n["tipo"] for n in r_admin.json()]
    assert "nueva_postulacion" in tipos_admin


def test_la_notificacion_de_difusion_no_aparece_en_las_del_candidato():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/notificaciones/me", headers=HEADERS_CANDIDATO)
    tipos = [n["tipo"] for n in r.json()]
    assert "nueva_postulacion" not in tipos


def test_otro_candidato_no_ve_la_notificacion_de_alguien_mas():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/notificaciones/me", headers=HEADERS_OTRO_CANDIDATO)
    assert r.json() == []


def test_cambiar_estado_genera_notificacion_de_cambio_para_el_candidato():
    r_crear = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r_crear.json()["radicado"]

    client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "Preseleccionado"}, headers=HEADERS_GESTOR)

    r = client.get("/api/v1/notificaciones/me", headers=HEADERS_CANDIDATO)
    tipos = [n["tipo"] for n in r.json()]
    assert "estado_cambiado" in tipos
    evento = next(n for n in r.json() if n["tipo"] == "estado_cambiado")
    assert "Preseleccionado" in evento["mensaje"]


def test_conteo_no_leidas_candidato():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/notificaciones/me/conteo", headers=HEADERS_CANDIDATO)
    assert r.json() == {"no_leidas": 1}


def test_conteo_no_leidas_gestion():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/notificaciones/me/conteo", headers=HEADERS_GESTOR)
    assert r.json() == {"no_leidas": 1}


def test_marcar_leida_notificacion_de_candidato():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    notif_id = client.get("/api/v1/notificaciones/me", headers=HEADERS_CANDIDATO).json()[0]["id"]

    r = client.patch(f"/api/v1/notificaciones/{notif_id}/leida", headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.json()["leida"] is True


def test_marcar_leida_notificacion_de_difusion_por_gestion():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    notif_id = client.get("/api/v1/notificaciones/me", headers=HEADERS_GESTOR).json()[0]["id"]

    r = client.patch(f"/api/v1/notificaciones/{notif_id}/leida", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    assert r.json()["leida"] is True


def test_candidato_no_puede_marcar_leida_una_notificacion_de_difusion():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    notif_id = client.get("/api/v1/notificaciones/me", headers=HEADERS_GESTOR).json()[0]["id"]

    # El candidato intenta marcar la de difusión de Gestión Humana como propia — no existe para él.
    r = client.patch(f"/api/v1/notificaciones/{notif_id}/leida", headers=HEADERS_CANDIDATO)
    assert r.status_code == 404


def test_marcar_todas_leidas_candidato():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    client.post("/api/v1/notificaciones/me/marcar-todas-leidas", headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/notificaciones/me/conteo", headers=HEADERS_CANDIDATO)
    assert r.json() == {"no_leidas": 0}


def test_correo_de_confirmacion_se_intenta_enviar(monkeypatch):
    from app.services import email_service

    llamadas = []
    monkeypatch.setattr(
        email_service, "enviar_correo_solicitud_recibida",
        lambda destinatario, nombre, cargo, radicado: llamadas.append((destinatario, cargo)) or True,
    )
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    assert len(llamadas) == 1
    assert llamadas[0][0] == SOLICITUD_VALIDA["datos_personales"]["correo"]


def test_correo_de_cambio_de_estado_se_intenta_enviar(monkeypatch):
    from app.services import email_service

    llamadas = []
    monkeypatch.setattr(
        email_service, "enviar_correo_cambio_estado",
        lambda destinatario, nombre, cargo, radicado, nuevo_estado: llamadas.append((destinatario, nuevo_estado)) or True,
    )
    r_crear = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r_crear.json()["radicado"]
    client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "Rechazada"}, headers=HEADERS_GESTOR)

    assert len(llamadas) == 1
    assert llamadas[0][1] == "Rechazada"
