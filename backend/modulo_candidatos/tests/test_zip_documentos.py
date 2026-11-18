# ==============================================================
# modulo_candidatos / tests/test_zip_documentos.py
# Descargar todos los documentos de un perfil o de una postulación en un .zip.
# ==============================================================

import base64
import io
import os
import sys
import zipfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from tests.conftest import client
from tests.test_solicitudes import HEADERS_CANDIDATO, HEADERS_OTRO_CANDIDATO, HEADERS_GESTOR, SOLICITUD_VALIDA
from tests.test_perfil_candidato import PERFIL_VALIDO
from app.services import zip_documentos_service

pytestmark = pytest.mark.usefixtures("mock_vacantes")


def _nombres(contenido: bytes) -> list[str]:
    return sorted(zipfile.ZipFile(io.BytesIO(contenido)).namelist())


def test_armar_zip_organiza_por_carpetas_y_numera_nombres_repetidos():
    b64 = base64.b64encode(b"%PDF-1.4 prueba").decode()
    contenido = zip_documentos_service.armar_zip({
        "cedula": [{"nombre": "cédula.pdf", "contenido_base64": b64}],
        "certificados_laborales": [
            {"nombre": "certificado.pdf", "contenido_base64": b64},
            {"nombre": "certificado.pdf", "contenido_base64": b64},
        ],
        "certificados_estudio": [{"nombre": "../../malicioso.pdf", "contenido_base64": b64}],
    })
    assert _nombres(contenido) == [
        "1. Cedula de ciudadania/cedula.pdf",
        "2. Certificados laborales/certificado (2).pdf",
        "2. Certificados laborales/certificado.pdf",
        "3. Certificados de estudio y cursos/malicioso.pdf",
    ]
    assert zipfile.ZipFile(io.BytesIO(contenido)).read("1. Cedula de ciudadania/cedula.pdf") == b"%PDF-1.4 prueba"


def test_armar_zip_sin_documentos_validos_falla():
    with pytest.raises(zip_documentos_service.SinDocumentosError):
        zip_documentos_service.armar_zip({"cedula": [{"nombre": "x.pdf", "contenido_base64": "%%no-es-base64%%"}]})


def test_candidato_descarga_todos_los_documentos_de_su_perfil():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/perfiles/me/documentos/zip", headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    assert "attachment" in r.headers["content-disposition"]
    assert len(_nombres(r.content)) == 4  # cédula, laboral, estudio y tarjeta profesional


def test_zip_de_perfil_sin_perfil_da_404():
    assert client.get("/api/v1/perfiles/me/documentos/zip", headers=HEADERS_CANDIDATO).status_code == 404


def test_gestion_humana_descarga_el_zip_del_perfil_de_un_candidato_y_otro_candidato_no():
    client.put("/api/v1/perfiles/me", json=PERFIL_VALIDO, headers=HEADERS_CANDIDATO)
    r = client.get("/api/v1/perfiles/admin/candidato-1/documentos/zip", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    assert len(_nombres(r.content)) == 4
    assert client.get("/api/v1/perfiles/admin/candidato-1/documentos/zip", headers=HEADERS_OTRO_CANDIDATO).status_code == 403


def test_zip_de_postulacion_para_el_dueno_y_gestion_humana_pero_no_para_otro_candidato():
    radicado = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO).json()["radicado"]
    url = f"/api/v1/solicitudes/{radicado}/documentos/zip"

    propio = client.get(url, headers=HEADERS_CANDIDATO)
    assert propio.status_code == 200
    assert len(_nombres(propio.content)) == 4
    assert radicado in propio.headers["content-disposition"]

    assert client.get(url, headers=HEADERS_GESTOR).status_code == 200
    assert client.get(url, headers=HEADERS_OTRO_CANDIDATO).status_code == 403
    assert client.get("/api/v1/solicitudes/no-existe/documentos/zip", headers=HEADERS_GESTOR).status_code == 404
