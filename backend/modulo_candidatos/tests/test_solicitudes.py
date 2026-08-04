# ==============================================================
# modulo_candidatos / tests/test_solicitudes.py
# ==============================================================

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import jwt

from app.core.config import settings
from app.clients import vacantes_client
from tests.conftest import client

def token_para(sub: str, rol: str = "candidato", nombre: str = "Candidato Uno") -> str:
    payload = {"sub": sub, "rol": rol, "email": f"{sub}@example.com", "nombre": nombre}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


HEADERS_CANDIDATO = {"Authorization": f"Bearer {token_para('candidato-1')}"}
HEADERS_OTRO_CANDIDATO = {"Authorization": f"Bearer {token_para('candidato-2')}"}
HEADERS_GESTOR = {"Authorization": f"Bearer {token_para('gestor-1', rol='gestor_humano', nombre='Gestora')}"}
HEADERS_ADMIN = {"Authorization": f"Bearer {token_para('admin-1', rol='admin', nombre='Admin Uno')}"}

VACANTE_ABIERTA = {
    "id": "vac-1",
    "cargo": "Analista de Gestión Humana",
    "esta_cerrada": False,
    "criterios": {"nivel_educativo_min": "Universitario", "graduado_requerido": True, "experiencia_min_anios": 2},
}

DOCUMENTOS_VALIDOS = {
    "cedula": [{"nombre": "cedula.pdf", "contenido_base64": "JVBERi0xLjQ="}],
    "certificados_laborales": [{"nombre": "laboral1.pdf", "contenido_base64": "JVBERi0xLjQ="}],
    "certificados_estudio": [{"nombre": "estudio1.pdf", "contenido_base64": "JVBERi0xLjQ="}],
    "tarjeta_profesional": [{"nombre": "tarjeta.pdf", "contenido_base64": "JVBERi0xLjQ="}],
}

SOLICITUD_VALIDA = {
    "vacante_id": "vac-1",
    "datos_personales": {
        "nombreCompleto": "Estefanía Delgado Bernal",
        "cedula": "1000644999",
        "correo": "estefania@example.com",
        "celular": "3225989990",
        "municipio": "Medellín",
    },
    "registros_ii": [],
    "experiencia": [],
    "conflicto": {"tieneVinculo": "no", "tieneOtraInhabilidad": "no"},
    "autorizacion": {"nombreCompleto": "Estefanía Delgado Bernal"},
    "documentos_adjuntos": DOCUMENTOS_VALIDOS,
}


@pytest.fixture(autouse=True)
def mock_vacantes(monkeypatch):
    def fake_obtener_vacante(vacante_id, token=None):
        if vacante_id == "vac-1":
            return VACANTE_ABIERTA
        if vacante_id == "vac-cerrada":
            return {**VACANTE_ABIERTA, "id": "vac-cerrada", "esta_cerrada": True}
        return None

    monkeypatch.setattr(vacantes_client, "obtener_vacante", fake_obtener_vacante)
    yield


def test_health_check():
    assert client.get("/health").json()["estado"] == "saludable"


def test_crear_solicitud_sin_token_rechazada():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA)
    assert r.status_code == 401


def test_crear_solicitud_vacante_inexistente():
    datos = {**SOLICITUD_VALIDA, "vacante_id": "no-existe"}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 404


def test_crear_solicitud_vacante_cerrada():
    datos = {**SOLICITUD_VALIDA, "vacante_id": "vac-cerrada"}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409


def test_crear_solicitud_exitosa_y_evaluacion_no_cumple():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    assert r.status_code == 201
    data = r.json()
    assert data["radicado"].startswith("SOL-")
    assert data["estado"] == "Recibida"
    # No registró estudios ni experiencia, así que NO cumple los criterios de la vacante.
    assert data["evaluacion"]["cumple"] is False
    assert len(data["evaluacion"]["motivos"]) == 2  # nivel educativo + experiencia mínima


def test_crear_solicitud_exitosa_y_evaluacion_cumple():
    datos = {
        **SOLICITUD_VALIDA,
        "registros_ii": [{"tipo": "estudio", "nivelEducativo": "Universitario", "graduado": "si", "titulo": "Ingeniería"}],
        "experiencia": [{"fechaInicio": "2020-01-01", "fechaTerminacion": "2023-01-01"}],
    }
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 201
    assert r.json()["evaluacion"]["cumple"] is True


def test_no_se_puede_postular_dos_veces_a_la_misma_vacante():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    r2 = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    assert r2.status_code == 409


def test_mis_solicitudes_solo_devuelve_las_propias():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/solicitudes/mias", headers=HEADERS_OTRO_CANDIDATO)
    assert r.status_code == 200
    assert r.json() == []

    r2 = client.get("/api/v1/solicitudes/mias", headers=HEADERS_CANDIDATO)
    assert len(r2.json()) == 1


def test_otro_candidato_no_puede_ver_solicitud_ajena_pero_gestor_si():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r.json()["radicado"]

    r_ajeno = client.get(f"/api/v1/solicitudes/{radicado}", headers=HEADERS_OTRO_CANDIDATO)
    assert r_ajeno.status_code == 403

    r_dueno = client.get(f"/api/v1/solicitudes/{radicado}", headers=HEADERS_CANDIDATO)
    assert r_dueno.status_code == 200

    r_gestor = client.get(f"/api/v1/solicitudes/{radicado}", headers=HEADERS_GESTOR)
    assert r_gestor.status_code == 200


def test_listar_postulaciones_de_vacante_requiere_rol_gestion():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)

    r_candidato = client.get("/api/v1/solicitudes/vacante/vac-1", headers=HEADERS_CANDIDATO)
    assert r_candidato.status_code == 403

    r_gestor = client.get("/api/v1/solicitudes/vacante/vac-1", headers=HEADERS_GESTOR)
    assert r_gestor.status_code == 200
    assert len(r_gestor.json()) == 1


def test_cambiar_estado_requiere_rol_gestion_y_actualiza_historial():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r.json()["radicado"]

    r_candidato = client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "En revisión"}, headers=HEADERS_CANDIDATO)
    assert r_candidato.status_code == 403

    r_gestor = client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "En revisión"}, headers=HEADERS_GESTOR)
    assert r_gestor.status_code == 200
    assert r_gestor.json()["estado"] == "En revisión"
    assert len(r_gestor.json()["historial_estados"]) == 2


def test_descargar_pdf_devuelve_documento_valido():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r.json()["radicado"]

    r_pdf = client.get(f"/api/v1/solicitudes/{radicado}/pdf", headers=HEADERS_CANDIDATO)
    assert r_pdf.status_code == 200
    assert r_pdf.headers["content-type"] == "application/pdf"
    assert r_pdf.content[:4] == b"%PDF"
    assert len(r_pdf.content) > 1000

    r_ajeno = client.get(f"/api/v1/solicitudes/{radicado}/pdf", headers=HEADERS_OTRO_CANDIDATO)
    assert r_ajeno.status_code == 403


def test_estadisticas_requiere_rol_gestion():
    r = client.get("/api/v1/solicitudes/admin/estadisticas", headers=HEADERS_CANDIDATO)
    assert r.status_code == 403


def test_conteo_por_vacante_requiere_rol_gestion():
    r = client.get("/api/v1/solicitudes/admin/conteo-por-vacante", headers=HEADERS_CANDIDATO)
    assert r.status_code == 403


def test_conteo_por_vacante_cuenta_correctamente():
    headers_candidato_3 = {"Authorization": f"Bearer {token_para('candidato-3')}"}
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_OTRO_CANDIDATO)
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=headers_candidato_3)

    r = client.get("/api/v1/solicitudes/admin/conteo-por-vacante", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    assert r.json()["vac-1"] == 3


def test_estadisticas_devuelve_conteos_reales():
    r1 = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado1 = r1.json()["radicado"]
    client.post("/api/v1/solicitudes", json={**SOLICITUD_VALIDA, "vacante_id": "vac-1"}, headers=HEADERS_OTRO_CANDIDATO)
    client.patch(f"/api/v1/solicitudes/{radicado1}/estado", json={"estado": "En revisión"}, headers=HEADERS_GESTOR)

    r = client.get("/api/v1/solicitudes/admin/estadisticas", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 2
    assert data["por_estado"]["En revisión"] == 1
    assert data["por_estado"]["Recibida"] == 1
    assert len(data["por_mes"]) == 6  # siempre 6 meses, aunque algunos estén en 0
    assert sum(p["total"] for p in data["por_mes"]) == 2
    assert len(data["recientes"]) == 2
    assert data["recientes"][0]["nombre_completo"] == "Estefanía Delgado Bernal"


def test_auditoria_requiere_rol_admin_no_solo_gestion():
    r = client.get("/api/v1/solicitudes/admin/auditoria/eventos", headers=HEADERS_GESTOR)
    assert r.status_code == 403  # gestor_humano no basta, esto es solo para admin


def test_auditoria_registra_solicitud_creada_y_estado_cambiado():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r.json()["radicado"]
    client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "En revisión"}, headers=HEADERS_GESTOR)

    r_auditoria = client.get("/api/v1/solicitudes/admin/auditoria/eventos", headers=HEADERS_ADMIN)
    assert r_auditoria.status_code == 200
    tipos = [e["tipo"] for e in r_auditoria.json()]
    assert "solicitud_creada" in tipos
    assert "estado_cambiado" in tipos

    evento_estado = next(e for e in r_auditoria.json() if e["tipo"] == "estado_cambiado")
    assert "Recibida" in evento_estado["descripcion"]
    assert "En revisión" in evento_estado["descripcion"]


def test_auditoria_registra_eliminacion_por_derecho_de_supresion():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r.json()["radicado"]
    client.delete(f"/api/v1/solicitudes/{radicado}", headers=HEADERS_CANDIDATO)

    r_auditoria = client.get("/api/v1/solicitudes/admin/auditoria/eventos", headers=HEADERS_ADMIN)
    tipos = [e["tipo"] for e in r_auditoria.json()]
    assert "solicitud_eliminada" in tipos


def test_auditoria_registra_anonimizacion_solo_si_procesa_algo():
    # Sin nada vencido, no debe generar evento (evita ruido de corridas vacías).
    client.post("/api/v1/solicitudes/admin/anonimizar-vencidas", headers=HEADERS_GESTOR)
    r_auditoria = client.get("/api/v1/solicitudes/admin/auditoria/eventos", headers=HEADERS_ADMIN)
    tipos = [e["tipo"] for e in r_auditoria.json()]
    assert "anonimizacion_ejecutada" not in tipos


# ---------------------------------------------------------------
# Documentos adjuntos obligatorios
# ---------------------------------------------------------------

def test_no_se_puede_enviar_sin_ningun_documento_adjunto_objeto_vacio():
    # Prueba de regresión: esto es justo lo que se coló la primera vez —
    # mandar "documentos_adjuntos": {} (sin ninguna llave) en vez de listas
    # vacías explícitas. Con field_validator esto NO se validaba porque
    # Pydantic v2 no corre field_validator sobre valores por defecto.
    datos = {**SOLICITUD_VALIDA, "documentos_adjuntos": {}}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422


def test_no_se_puede_enviar_sin_cedula():
    datos = {**SOLICITUD_VALIDA, "documentos_adjuntos": {**DOCUMENTOS_VALIDOS, "cedula": []}}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422
    assert "cédula" in str(r.json()).lower()


def test_no_se_puede_enviar_sin_certificados_laborales():
    datos = {**SOLICITUD_VALIDA, "documentos_adjuntos": {**DOCUMENTOS_VALIDOS, "certificados_laborales": []}}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422
    assert "laboral" in str(r.json()).lower()


def test_no_se_puede_enviar_sin_certificados_estudio():
    datos = {**SOLICITUD_VALIDA, "documentos_adjuntos": {**DOCUMENTOS_VALIDOS, "certificados_estudio": []}}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422


def test_no_se_puede_enviar_sin_tarjeta_profesional():
    datos = {**SOLICITUD_VALIDA, "documentos_adjuntos": {**DOCUMENTOS_VALIDOS, "tarjeta_profesional": []}}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422


def test_cedula_rechaza_mas_de_1_archivo():
    doc = DOCUMENTOS_VALIDOS["cedula"][0]
    datos = {**SOLICITUD_VALIDA, "documentos_adjuntos": {**DOCUMENTOS_VALIDOS, "cedula": [doc, doc]}}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422


def test_certificados_laborales_acepta_hasta_10():
    doc = DOCUMENTOS_VALIDOS["certificados_laborales"][0]
    datos = {**SOLICITUD_VALIDA, "documentos_adjuntos": {**DOCUMENTOS_VALIDOS, "certificados_laborales": [doc] * 10}}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 201


def test_certificados_laborales_rechaza_mas_de_10():
    doc = DOCUMENTOS_VALIDOS["certificados_laborales"][0]
    datos = {**SOLICITUD_VALIDA, "documentos_adjuntos": {**DOCUMENTOS_VALIDOS, "certificados_laborales": [doc] * 11}}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422


def test_tarjeta_profesional_rechaza_mas_de_3():
    doc = DOCUMENTOS_VALIDOS["tarjeta_profesional"][0]
    datos = {**SOLICITUD_VALIDA, "documentos_adjuntos": {**DOCUMENTOS_VALIDOS, "tarjeta_profesional": [doc] * 4}}
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422


def test_rechaza_archivo_de_mas_de_5mb():
    contenido_grande_base64 = "A" * (7 * 1024 * 1024)  # ~5.25MB reales tras decodificar
    datos = {
        **SOLICITUD_VALIDA,
        "documentos_adjuntos": {**DOCUMENTOS_VALIDOS, "cedula": [{"nombre": "grande.pdf", "contenido_base64": contenido_grande_base64}]},
    }
    r = client.post("/api/v1/solicitudes", json=datos, headers=HEADERS_CANDIDATO)
    assert r.status_code == 422


def test_descargar_documento_adjunto():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r.json()["radicado"]

    r_doc = client.get(f"/api/v1/solicitudes/{radicado}/documentos/cedula/0", headers=HEADERS_CANDIDATO)
    assert r_doc.status_code == 200
    assert r_doc.content == b"%PDF-1.4"  # JVBERi0xLjQ= decodificado


def test_descargar_documento_de_otro_candidato_es_rechazado():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r.json()["radicado"]

    r_doc = client.get(f"/api/v1/solicitudes/{radicado}/documentos/cedula/0", headers=HEADERS_OTRO_CANDIDATO)
    assert r_doc.status_code == 403


def test_descargar_documento_con_indice_invalido_da_404():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    radicado = r.json()["radicado"]

    r_doc = client.get(f"/api/v1/solicitudes/{radicado}/documentos/cedula/5", headers=HEADERS_CANDIDATO)
    assert r_doc.status_code == 404


def test_solicitud_out_no_expone_el_contenido_base64_solo_el_nombre():
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    data = r.json()
    assert data["documentos_adjuntos"]["cedula"][0]["nombre"] == "cedula.pdf"
    assert "contenido_base64" not in data["documentos_adjuntos"]["cedula"][0]
