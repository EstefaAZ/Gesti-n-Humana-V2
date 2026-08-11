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


def test_inscribirme_guarda_el_nombre_de_la_vacante_en_la_solicitud():
    # VACANTE_ABIERTA (mock) tiene cargo="Analista de Gestión Humana"
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    assert r.json()["vacante_cargo"] == "Analista de Gestión Humana"


def test_el_nombre_de_la_vacante_sigue_disponible_aunque_la_vacante_cambie_de_estado(monkeypatch):
    from app.clients import vacantes_client as vc

    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)

    # Simula que la vacante ya no es visible para candidatos (pasó a "en_proceso").
    monkeypatch.setattr(vc, "obtener_vacante", lambda vacante_id, token=None: None)

    r = client.get("/api/v1/solicitudes/mias", headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.json()[0]["vacante_cargo"] == "Analista de Gestión Humana"  # sigue viéndose, sin depender de Vacantes


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


# ---------------------------------------------------------------
# Retirar postulación (no borra nada, solo cambia el estado)
# ---------------------------------------------------------------

def test_retirar_postulacion_no_borra_nada_solo_cambia_el_estado():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r_crear = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    radicado = r_crear.json()["radicado"]

    r = client.patch(f"/api/v1/solicitudes/{radicado}/retirar", headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.json()["estado"] == "Retirada"
    assert r.json()["datos_personales"]["nombreCompleto"] == "Candidato Uno"

    r_get = client.get(f"/api/v1/solicitudes/{radicado}", headers=HEADERS_GESTOR)
    assert r_get.status_code == 200
    assert r_get.json()["estado"] == "Retirada"


def test_no_se_puede_retirar_la_postulacion_de_otro_candidato():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r_crear = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    radicado = r_crear.json()["radicado"]

    r = client.patch(f"/api/v1/solicitudes/{radicado}/retirar", headers=HEADERS_OTRO_CANDIDATO)
    assert r.status_code == 403


def test_no_se_puede_retirar_una_postulacion_ya_aceptada():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r_crear = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    radicado = r_crear.json()["radicado"]
    client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "Aceptada"}, headers=HEADERS_GESTOR)

    r = client.patch(f"/api/v1/solicitudes/{radicado}/retirar", headers=HEADERS_CANDIDATO)
    assert r.status_code == 403


def test_retirar_postulacion_inexistente_da_404():
    r = client.patch("/api/v1/solicitudes/SOL-NOEXISTE/retirar", headers=HEADERS_CANDIDATO)
    assert r.status_code == 404


def test_retirar_postulacion_genera_notificacion_para_gestion():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r_crear = client.post("/api/v1/solicitudes/inscribirme", json={"vacante_id": "vac-1"}, headers=HEADERS_CANDIDATO)
    radicado = r_crear.json()["radicado"]
    client.patch(f"/api/v1/solicitudes/{radicado}/retirar", headers=HEADERS_CANDIDATO)

    r = client.get("/api/v1/notificaciones/me", headers=HEADERS_GESTOR)
    tipos = [n["tipo"] for n in r.json()]
    assert "postulacion_retirada" in tipos


# ---------------------------------------------------------------
# Borrador (guardado automático mientras avanza el wizard)
# ---------------------------------------------------------------

def test_guardar_borrador_vacio_no_falla():
    r = client.put("/api/v1/perfiles/me/borrador", json={}, headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.json()["completado"] is False


def test_borrador_guarda_datos_parciales_sin_exigir_nada():
    r = client.put(
        "/api/v1/perfiles/me/borrador",
        json={"datos_personales": {"nombreCompleto": "Candidato Uno", "cedula": "123"}},
        headers=HEADERS_CANDIDATO,
    )
    assert r.status_code == 200
    assert r.json()["datos_personales"]["cedula"] == "123"
    assert r.json()["completado"] is False


def test_borrador_no_exige_documentos_ni_autorizacion():
    r = client.put(
        "/api/v1/perfiles/me/borrador",
        json={"registros_ii": [{"tipo": "estudio", "nivelEducativo": "Universitario"}]},
        headers=HEADERS_CANDIDATO,
    )
    assert r.status_code == 200


def test_borrador_no_exige_que_el_nombre_de_autorizacion_coincida():
    # A diferencia de guardar_perfil, el borrador NO valida el nombre — el
    # candidato puede ir armando la Hoja I sin haber llegado a Autorización.
    r = client.put(
        "/api/v1/perfiles/me/borrador",
        json={"autorizacion": {"nombreCompleto": "Cualquier Cosa Sin Validar"}},
        headers=HEADERS_CANDIDATO,
    )
    assert r.status_code == 200


def test_el_estado_del_perfil_sigue_incompleto_despues_de_un_borrador():
    client.put("/api/v1/perfiles/me/borrador", json={"datos_personales": {"nombreCompleto": "X"}}, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/perfiles/me/estado", headers=HEADERS_CANDIDATO)
    assert r.json() == {"existe": True, "completado": False}


def test_borrador_se_puede_seguir_editando_y_retomar_donde_quedo():
    client.put("/api/v1/perfiles/me/borrador", json={"datos_personales": {"nombreCompleto": "Ana"}}, headers=HEADERS_CANDIDATO)
    client.put("/api/v1/perfiles/me/borrador", json={
        "datos_personales": {"nombreCompleto": "Ana"},
        "registros_ii": [{"tipo": "estudio", "nivelEducativo": "Técnico"}],
    }, headers=HEADERS_CANDIDATO)

    r = client.get("/api/v1/perfiles/me", headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.json()["datos_personales"]["nombreCompleto"] == "Ana"
    assert len(r.json()["registros_ii"]) == 1


def test_guardar_borrador_sobre_un_perfil_ya_completado_no_lo_desmarca():
    # El candidato ya había terminado su perfil hace tiempo. Ahora vuelve a
    # editarlo (ej. agregar una experiencia nueva) — mientras escribe, el
    # guardado automático de fondo NO debe sacarlo del sitio.
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r_estado_antes = client.get("/api/v1/perfiles/me/estado", headers=HEADERS_CANDIDATO)
    assert r_estado_antes.json()["completado"] is True

    client.put("/api/v1/perfiles/me/borrador", json={"datos_personales": {"nombreCompleto": "Candidato Uno", "telefonoNuevo": "300"}}, headers=HEADERS_CANDIDATO)

    r_estado_despues = client.get("/api/v1/perfiles/me/estado", headers=HEADERS_CANDIDATO)
    assert r_estado_despues.json()["completado"] is True  # sigue completo, el borrador no lo tocó


def test_borrador_requiere_rol_candidato():
    r = client.put("/api/v1/perfiles/me/borrador", json={}, headers=HEADERS_GESTOR)
    assert r.status_code == 403
