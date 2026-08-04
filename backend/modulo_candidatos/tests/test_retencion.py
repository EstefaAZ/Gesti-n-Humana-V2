# ==============================================================
# modulo_candidatos / tests/test_retencion.py
# Habeas data (Ley 1581 de 2012): supresión a pedido y anonimización
# automática por vencimiento del período de retención.
# ==============================================================

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import jwt

from app.core.config import settings
from app.clients import vacantes_client
from app.models.solicitud import Solicitud
from tests.conftest import client, TestingSessionLocal


def token_para(sub: str, rol: str = "candidato") -> str:
    payload = {"sub": sub, "rol": rol, "email": f"{sub}@example.com", "nombre": "Persona de Prueba"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


VACANTE_ABIERTA = {"id": "vac-1", "esta_cerrada": False, "criterios": {}}


@pytest.fixture(autouse=True)
def mock_vacantes(monkeypatch):
    monkeypatch.setattr(vacantes_client, "obtener_vacante", lambda vacante_id, token=None: VACANTE_ABIERTA)
    yield


DOCUMENTOS_VALIDOS = {
    "cedula": [{"nombre": "cedula.pdf", "contenido_base64": "JVBERi0xLjQ="}],
    "certificados_laborales": [{"nombre": "laboral1.pdf", "contenido_base64": "JVBERi0xLjQ="}],
    "certificados_estudio": [{"nombre": "estudio1.pdf", "contenido_base64": "JVBERi0xLjQ="}],
    "tarjeta_profesional": [{"nombre": "tarjeta.pdf", "contenido_base64": "JVBERi0xLjQ="}],
}


def _crear_solicitud(usuario_id, radicado_esperado_prefix="SOL"):
    headers = {"Authorization": f"Bearer {token_para(usuario_id)}"}
    r = client.post(
        "/api/v1/solicitudes",
        json={
            "vacante_id": "vac-1",
            "datos_personales": {"nombreCompleto": "Ana Pérez", "cedula": "123", "correo": "ana@example.com"},
            "autorizacion": {"nombreCompleto": "Ana Pérez"},
            "documentos_adjuntos": DOCUMENTOS_VALIDOS,
        },
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()["radicado"], headers


# ---------------------------------------------------------------
# Eliminación propia (derecho de supresión)
# ---------------------------------------------------------------

def test_candidato_puede_eliminar_su_propia_solicitud():
    radicado, headers = _crear_solicitud("candidato-1")
    r = client.delete(f"/api/v1/solicitudes/{radicado}", headers=headers)
    assert r.status_code == 204

    r_get = client.get(f"/api/v1/solicitudes/{radicado}", headers=headers)
    assert r_get.status_code == 404  # ya no existe, de verdad se borró


def test_no_se_puede_eliminar_la_solicitud_de_otro_candidato():
    radicado, _ = _crear_solicitud("candidato-1")
    headers_otro = {"Authorization": f"Bearer {token_para('candidato-2')}"}
    r = client.delete(f"/api/v1/solicitudes/{radicado}", headers=headers_otro)
    assert r.status_code == 403


def test_no_se_puede_eliminar_una_solicitud_aceptada():
    radicado, headers = _crear_solicitud("candidato-1")
    headers_gestor = {"Authorization": f"Bearer {token_para('gestor-1', rol='gestor_humano')}"}
    client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "Aceptada"}, headers=headers_gestor)

    r = client.delete(f"/api/v1/solicitudes/{radicado}", headers=headers)
    assert r.status_code == 403
    assert "expediente laboral" in r.json()["detail"]


def test_eliminar_solicitud_inexistente_da_404():
    headers = {"Authorization": f"Bearer {token_para('candidato-1')}"}
    r = client.delete("/api/v1/solicitudes/SOL-NO-EXISTE", headers=headers)
    assert r.status_code == 404


# ---------------------------------------------------------------
# Anonimización automática por vencimiento
# ---------------------------------------------------------------

def _forzar_fecha_antigua(radicado, dias_atras):
    db = TestingSessionLocal()
    s = db.query(Solicitud).filter(Solicitud.radicado == radicado).first()
    s.fecha_solicitud = datetime.now(timezone.utc) - timedelta(days=dias_atras)
    db.commit()
    db.close()


def test_anonimizar_vencidas_requiere_rol_gestion():
    r = client.post("/api/v1/solicitudes/admin/anonimizar-vencidas", headers={"Authorization": f"Bearer {token_para('candidato-1')}"})
    assert r.status_code == 403


def test_solicitud_reciente_no_se_anonimiza():
    radicado, headers = _crear_solicitud("candidato-1")
    headers_gestor = {"Authorization": f"Bearer {token_para('gestor-1', rol='gestor_humano')}"}

    r = client.post("/api/v1/solicitudes/admin/anonimizar-vencidas", headers=headers_gestor)
    assert r.status_code == 200
    assert r.json()["solicitudes_anonimizadas"] == 0

    r_get = client.get(f"/api/v1/solicitudes/{radicado}", headers=headers)
    assert r_get.json()["datos_personales"]["nombreCompleto"] == "Ana Pérez"  # intacto


def test_solicitud_vencida_se_anonimiza_pero_no_se_borra():
    radicado, headers = _crear_solicitud("candidato-1")
    dias_retencion = settings.RETENCION_MESES_NO_SELECCIONADOS * 30
    _forzar_fecha_antigua(radicado, dias_retencion + 5)

    headers_gestor = {"Authorization": f"Bearer {token_para('gestor-1', rol='gestor_humano')}"}
    r = client.post("/api/v1/solicitudes/admin/anonimizar-vencidas", headers=headers_gestor)
    assert r.json()["solicitudes_anonimizadas"] == 1

    r_get = client.get(f"/api/v1/solicitudes/{radicado}", headers=headers)
    assert r_get.status_code == 200  # sigue existiendo (no se borró)
    dp = r_get.json()["datos_personales"]
    assert dp["nombreCompleto"] == "ANONIMIZADO"
    assert dp["cedula"] == "ANONIMIZADO"
    assert r_get.json()["anonimizada"] is True


def test_solicitud_aceptada_no_se_anonimiza_aunque_este_vencida():
    radicado, headers = _crear_solicitud("candidato-1")
    headers_gestor = {"Authorization": f"Bearer {token_para('gestor-1', rol='gestor_humano')}"}
    client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "Aceptada"}, headers=headers_gestor)

    dias_retencion = settings.RETENCION_MESES_NO_SELECCIONADOS * 30
    _forzar_fecha_antigua(radicado, dias_retencion + 5)

    r = client.post("/api/v1/solicitudes/admin/anonimizar-vencidas", headers=headers_gestor)
    assert r.json()["solicitudes_anonimizadas"] == 0

    r_get = client.get(f"/api/v1/solicitudes/{radicado}", headers=headers)
    assert r_get.json()["datos_personales"]["nombreCompleto"] == "Ana Pérez"  # intacto, pasó a expediente laboral
