# ==============================================================
# modulo_candidatos / tests/test_perfil_candidato.py
# ==============================================================

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from tests.conftest import client
from tests.test_solicitudes import (
    token_para, HEADERS_CANDIDATO, HEADERS_OTRO_CANDIDATO, HEADERS_GESTOR, HEADERS_ADMIN, DOCUMENTOS_VALIDOS, SOLICITUD_VALIDA,
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


# ---------------------------------------------------------------
# Corrección: autorizacion.nombreCompleto (no nombre_completo) en la solicitud
# ---------------------------------------------------------------

def test_inscribirme_guarda_autorizacion_en_camelcase_como_el_resto_del_sistema():
    # Bug de regresión: el perfil guarda autorizacion.nombre_completo (snake_case,
    # viene del esquema Pydantic), pero el resto del sistema (Hoja VIII, PDF,
    # panel de Gestión Humana) siempre usó nombreCompleto (camelCase). Sin la
    # normalización, la sección "Autorización" se veía vacía en Gestión Humana.
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    assert r.json()["autorizacion"]["nombreCompleto"] == "Candidato Uno"
    assert r.json()["autorizacion"]["acepta"] is True
    assert "nombre_completo" not in r.json()["autorizacion"]


# ---------------------------------------------------------------
# Fecha de apertura futura: no debe dejar inscribirse todavía
# ---------------------------------------------------------------

def test_inscribirme_a_vacante_que_aun_no_abre_es_rechazado():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-no-abierta"}, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409
    assert "abre" in r.json()["detail"].lower()


def test_crear_solicitud_directa_a_vacante_que_aun_no_abre_tambien_es_rechazado():
    datos = {**SOLICITUD_VALIDA, "vacante_id": "vac-no-abierta"}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409


# ---------------------------------------------------------------
# Una sola postulación activa a la vez (GTH-FOR-02)
# ---------------------------------------------------------------

def test_no_puede_postularse_a_una_segunda_vacante_mientras_la_primera_sigue_publicada():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r1 = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    assert r1.status_code == 201

    r2 = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-2"}, headers=HEADERS_CANDIDATO)
    assert r2.status_code == 409
    assert "uno a la vez" in r2.json()["detail"]


def test_no_puede_postularse_a_una_vacante_ya_cerrada_de_entrada():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-cerrada"}, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409


def test_si_puede_postularse_a_otra_vacante_una_vez_la_primera_paso_a_cancelada(monkeypatch):
    from app.clients import vacantes_client as vc
    from tests.conftest import VACANTES_MOCK

    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r1 = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    assert r1.status_code == 201

    # Simula que "vac-1" pasó a cancelada_desierta después de que se postuló.
    vacante_1_cancelada = {**VACANTES_MOCK["vac-1"], "estado": "cancelada_desierta", "esta_cerrada": True}

    def fake_obtener_vacante(vacante_id, token=None):
        if vacante_id == "vac-1":
            return vacante_1_cancelada
        return VACANTES_MOCK.get(vacante_id)

    monkeypatch.setattr(vc, "obtener_vacante", fake_obtener_vacante)

    r2 = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-2"}, headers=HEADERS_CANDIDATO)
    assert r2.status_code == 201  # ahora sí puede, porque la primera ya no está "en curso"


def test_una_sola_postulacion_activa_tambien_aplica_al_endpoint_viejo_crear_solicitud():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)

    datos = {**SOLICITUD_VALIDA, "vacante_id": "vac-2"}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409


# ---------------------------------------------------------------
# Página "Candidatos" de Gestión Humana: listar todos los perfiles
# ---------------------------------------------------------------

def test_listar_todos_los_perfiles_requiere_rol_gestion():
    r = client.get("/api/v1/perfiles/admin/todos", headers=HEADERS_CANDIDATO)
    assert r.status_code == 403


def test_listar_todos_los_perfiles():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/perfiles/admin/todos", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["datos_personales"]["nombreCompleto"] == "Candidato Uno"


def test_listar_todos_los_perfiles_vacio_si_nadie_ha_completado_uno():
    r = client.get("/api/v1/perfiles/admin/todos", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    assert r.json() == []


# ---------------------------------------------------------------
# Descarga de documentos del perfil (candidato propio y Gestión Humana)
# ---------------------------------------------------------------

def test_descargar_mi_documento_de_perfil():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/perfiles/me/documentos/cedula/0", headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.content == b"%PDF-1.4"  # JVBERi0xLjQ= decodificado


def test_descargar_documento_de_perfil_sin_perfil_da_404():
    r = client.get("/api/v1/perfiles/me/documentos/cedula/0", headers=HEADERS_CANDIDATO)
    assert r.status_code == 404


def test_gestion_humana_puede_descargar_documento_del_perfil_de_un_candidato():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    # HEADERS_CANDIDATO usa token_para('candidato-1'), así que "candidato-1" ES el usuario_id.
    r = client.get("/api/v1/perfiles/admin/candidato-1/documentos/cedula/0", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    assert r.content == b"%PDF-1.4"


def test_candidato_no_puede_descargar_documentos_de_otro_por_admin():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/perfiles/admin/candidato-1/documentos/cedula/0", headers=HEADERS_CANDIDATO)
    assert r.status_code == 403
