# ==============================================================
# modulo_candidatos / tests/test_perfil_candidato.py
# ==============================================================

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from tests.conftest import client
from tests.test_solicitudes import (
    token_para, HEADERS_CANDIDATO, HEADERS_OTRO_CANDIDATO, HEADERS_GESTOR, HEADERS_ADMIN, DOCUMENTOS_VALIDOS,
)

pytestmark = pytest.mark.usefixtures("mock_vacantes")

PERFIL_VALIDO = {
    "datos_personales": {
        "nombreCompleto": "Candidato Uno",
        "cedula": "1000644999",
        "correo": "candidato1@example.com",
        "celular": "3225989990",
        "municipio": "Medellín",
    },
    "registros_ii": [],
    "experiencia": [],
    "conflicto": {"tieneVinculo": "no", "tieneOtraInhabilidad": "no"},
    "documentos_adjuntos": DOCUMENTOS_VALIDOS,
    "autorizacion": {"acepta": True, "nombre_completo": "Candidato Uno"},
}


def test_estado_del_perfil_antes_de_crearlo():
    r = client.get("/api/v1/perfiles/me/estado", headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.json() == {"existe": False, "completado": False}


def test_obtener_perfil_antes_de_crearlo_da_404():
    r = client.get("/api/v1/perfiles/me", headers=HEADERS_CANDIDATO)
    assert r.status_code == 404


def test_guardar_perfil_con_nombre_exacto():
    r = client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.json()["completado"] is True
    assert r.json()["autorizacion"]["nombre_completo"] == "Candidato Uno"


def test_guardar_perfil_con_nombre_flexible_mayusculas_y_espacios():
    # El token dice "Candidato Uno" — esto debe pasar aunque venga distinto en mayúsculas/espacios.
    datos = {**PERFIL_VALIDO, "autorizacion": {"acepta": True, "nombre_completo": "  candidato   UNO  "}}
    r = client.put("/api/v1/perfiles/me", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 200


def test_guardar_perfil_con_nombre_distinto_es_rechazado():
    datos = {**PERFIL_VALIDO, "autorizacion": {"acepta": True, "nombre_completo": "Otro Nombre Completamente"}}
    r = client.put("/api/v1/perfiles/me", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422
    assert "mismo" in r.json()["detail"].lower() or "registraste" in r.json()["detail"].lower()


def test_gestion_y_admin_no_pueden_usar_el_perfil_de_candidato():
    r_gestor = client.get("/api/v1/perfiles/me/estado", headers=HEADERS_GESTOR)
    assert r_gestor.status_code == 403
    r_admin = client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_ADMIN)
    assert r_admin.status_code == 403


def test_despues_de_guardar_estado_refleja_completado():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/perfiles/me/estado", headers=HEADERS_CANDIDATO)
    assert r.json() == {"existe": True, "completado": True}


def test_guardar_perfil_dos_veces_lo_reemplaza_no_lo_duplica():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    datos_editados = {**PERFIL_VALIDO, "datos_personales": {**PERFIL_VALIDO["datos_personales"], "celular": "3009999999"}}
    r = client.put("/api/v1/perfiles/me", json=datos_editados, headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.json()["datos_personales"]["celular"] == "3009999999"

    r_get = client.get("/api/v1/perfiles/me", headers=HEADERS_CANDIDATO)
    assert r_get.json()["datos_personales"]["celular"] == "3009999999"


# ---------------------------------------------------------------
# Inscribirse con un clic (reutiliza el perfil guardado)
# ---------------------------------------------------------------

def test_inscribirme_sin_perfil_completado_es_rechazado():
    r = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409


def test_inscribirme_con_perfil_completado_funciona():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    assert r.status_code == 201
    assert r.json()["datos_personales"]["nombreCompleto"] == "Candidato Uno"
    assert r.json()["documentos_adjuntos"]["cedula"][0]["nombre"] == "cedula.pdf"


def test_inscribirme_no_dejar_postularse_dos_veces_a_la_misma_vacante():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    r = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409


def test_inscribirme_a_vacante_cerrada_es_rechazado():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-cerrada"}, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409


def test_inscribirme_con_certificaciones_extra_las_combina_con_el_perfil():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    extra_doc = {"nombre": "curso-extra.pdf", "contenido_base64": "JVBERi0xLjQ="}
    r = client.post(
        "/api/v1/solicitudes/inscribirme",
        json={"vacante_id": "vac-1", "documentos_extra": {"certificados_estudio": [extra_doc]}},
        headers=HEADERS_CANDIDATO,
    )
    assert r.status_code == 201
    nombres = [d["nombre"] for d in r.json()["documentos_adjuntos"]["certificados_estudio"]]
    assert "estudio1.pdf" in nombres  # el del perfil
    assert "curso-extra.pdf" in nombres  # el extra de esta vacante


def test_inscribirme_respeta_el_maximo_al_combinar_documentos_extra():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    # El perfil ya trae 1 tarjeta profesional (máximo real: 3). Si mando 3 más
    # (válido para UNA solicitud extra), combinado serían 4 — debe recortarse a 3.
    doc = {"nombre": "extra.pdf", "contenido_base64": "JVBERi0xLjQ="}
    r = client.post(
        "/api/v1/solicitudes/inscribirme",
        json={"vacante_id": "vac-1", "documentos_extra": {"tarjeta_profesional": [doc, doc, doc]}},
        headers=HEADERS_CANDIDATO,
    )
    assert r.status_code == 201
    assert len(r.json()["documentos_adjuntos"]["tarjeta_profesional"]) == 3


def test_inscribirme_documentos_extra_no_afectan_el_perfil_guardado():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    extra_doc = {"nombre": "solo-para-esta-vacante.pdf", "contenido_base64": "JVBERi0xLjQ="}
    client.post(
        "/api/v1/solicitudes/inscribirme",
        json={"vacante_id": "vac-1", "documentos_extra": {"certificados_estudio": [extra_doc]}},
        headers=HEADERS_CANDIDATO,
    )
    r_perfil = client.get("/api/v1/perfiles/me", headers=HEADERS_CANDIDATO)
    nombres = [d["nombre"] for d in r_perfil.json()["documentos_adjuntos"]["certificados_estudio"]]
    assert "solo-para-esta-vacante.pdf" not in nombres


def test_inscribirme_requiere_rol_candidato():
    r = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_GESTOR)
    assert r.status_code == 403
