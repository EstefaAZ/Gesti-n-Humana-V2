# ==============================================================
# modulo_candidatos / tests/test_certificados.py
# Certificados laborales y de estudio después de la preselección
# (3 días hábiles, solo en la postulación).
# ==============================================================

import os
import sys
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from tests.conftest import client, TestingSessionLocal
from tests.test_solicitudes import HEADERS_CANDIDATO, HEADERS_GESTOR, SOLICITUD_VALIDA, token_para
from app.models.solicitud import Solicitud
from app.services import certificados_service as cs

pytestmark = pytest.mark.usefixtures("mock_vacantes")

HEADERS_OTRO = {"Authorization": f"Bearer {token_para('candidato-2')}"}
PDF = "JVBERi0xLjQ="
CERTIFICADOS = {
    "certificados_laborales": [{"nombre": "laboral.pdf", "contenido_base64": PDF}],
    "certificados_estudio": [{"nombre": "diploma.pdf", "contenido_base64": PDF}],
}
COT = timezone(timedelta(hours=-5))


# ---------------- Días hábiles en Colombia ----------------

@pytest.mark.parametrize("festivo", [
    date(2026, 1, 12),   # Reyes (6 de enero, trasladado al lunes)
    date(2026, 3, 23),   # San José (19 de marzo, trasladado)
    date(2026, 4, 2),    # Jueves Santo
    date(2026, 4, 3),    # Viernes Santo
    date(2026, 5, 18),   # Ascensión (trasladado)
    date(2026, 6, 8),    # Corpus Christi (trasladado)
    date(2026, 6, 15),   # Sagrado Corazón (trasladado)
    date(2026, 7, 20),   # Independencia
    date(2026, 11, 2),   # Todos los Santos (trasladado)
    date(2026, 11, 16),  # Independencia de Cartagena (trasladado)
    date(2026, 12, 8),
])
def test_festivos_colombia_2026(festivo):
    assert festivo in cs.festivos_colombia(2026)
    assert not cs.es_dia_habil(festivo)


def test_plazo_de_tres_dias_habiles_salta_el_fin_de_semana():
    # Preseleccionado el miércoles 25/11/2026 -> jueves, viernes y lunes 30.
    plazo = cs.calcular_plazo(datetime(2026, 11, 25, 10, 0, tzinfo=COT)).astimezone(COT)
    assert (plazo.date(), plazo.hour, plazo.minute) == (date(2026, 11, 30), 23, 59)


def test_plazo_salta_los_festivos():
    # Viernes 13/11/2026: el lunes 16 es festivo -> martes 17, miércoles 18, jueves 19.
    plazo = cs.calcular_plazo(datetime(2026, 11, 13, 9, 0, tzinfo=COT)).astimezone(COT)
    assert plazo.date() == date(2026, 11, 19)


# ---------------- Flujo ----------------

def _crear() -> str:
    r = client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)
    assert r.status_code == 201
    return r.json()["radicado"]


def _preseleccionar(radicado: str):
    r = client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "Preseleccionado"}, headers=HEADERS_GESTOR)
    assert r.status_code == 200
    return r.json()


def _vencer_plazo(radicado: str):
    db = TestingSessionLocal()
    s = db.query(Solicitud).filter(Solicitud.radicado == radicado).first()
    s.certificados_meta = {**s.certificados_meta, "plazo": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()}
    db.commit()
    db.close()


def test_antes_de_la_preseleccion_no_se_pueden_adjuntar():
    radicado = _crear()
    r = client.put(f"/api/v1/solicitudes/{radicado}/certificados", json=CERTIFICADOS, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409
    assert "preselecciona" in r.json()["detail"]


def test_al_preseleccionar_se_abre_el_plazo_y_se_avisa_al_candidato():
    radicado = _crear()
    datos = _preseleccionar(radicado)
    assert datos["certificados"]["estado"] == "pendientes"
    assert datos["certificados"]["puede_adjuntar"] is True
    plazo = datetime.fromisoformat(datos["certificados"]["plazo"].replace("Z", "+00:00"))
    assert plazo > datetime.now(timezone.utc) + timedelta(days=2)

    notifs = client.get("/api/v1/notificaciones/me", headers=HEADERS_CANDIDATO).json()
    aviso = next(n for n in notifs if n["tipo"] == "certificados_solicitados")
    assert "certificados" in aviso["mensaje"]


def test_el_candidato_adjunta_sus_certificados():
    radicado = _crear()
    _preseleccionar(radicado)
    r = client.put(f"/api/v1/solicitudes/{radicado}/certificados", json=CERTIFICADOS, headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    datos = r.json()
    assert datos["certificados"]["estado"] == "recibidos"
    assert [d["nombre"] for d in datos["documentos_adjuntos"]["certificados_laborales"]] == ["laboral.pdf"]
    assert [d["nombre"] for d in datos["documentos_adjuntos"]["certificados_estudio"]] == ["diploma.pdf"]

    notifs = client.get("/api/v1/notificaciones/me", headers=HEADERS_GESTOR).json()
    assert any(n["tipo"] == "certificados_adjuntados" for n in notifs)


def test_conserva_los_archivos_ya_subidos_por_nombre():
    radicado = _crear()
    _preseleccionar(radicado)
    client.put(f"/api/v1/solicitudes/{radicado}/certificados", json=CERTIFICADOS, headers=HEADERS_CANDIDATO)
    segunda = {
        "certificados_laborales": [{"nombre": "laboral.pdf"}, {"nombre": "laboral2.pdf", "contenido_base64": PDF}],
        "certificados_estudio": [],
    }
    r = client.put(f"/api/v1/solicitudes/{radicado}/certificados", json=segunda, headers=HEADERS_CANDIDATO)
    assert r.status_code == 200
    assert [d["nombre"] for d in r.json()["documentos_adjuntos"]["certificados_laborales"]] == ["laboral.pdf", "laboral2.pdf"]
    assert r.json()["documentos_adjuntos"]["certificados_estudio"] == []


def test_sin_ningun_archivo_es_rechazado():
    radicado = _crear()
    _preseleccionar(radicado)
    r = client.put(f"/api/v1/solicitudes/{radicado}/certificados", json={}, headers=HEADERS_CANDIDATO)
    assert r.status_code == 400


def test_otro_candidato_no_puede_adjuntar():
    radicado = _crear()
    _preseleccionar(radicado)
    r = client.put(f"/api/v1/solicitudes/{radicado}/certificados", json=CERTIFICADOS, headers=HEADERS_OTRO)
    assert r.status_code == 403


def test_con_el_plazo_vencido_no_se_puede_y_gestion_humana_lo_amplia():
    radicado = _crear()
    _preseleccionar(radicado)
    _vencer_plazo(radicado)

    r = client.put(f"/api/v1/solicitudes/{radicado}/certificados", json=CERTIFICADOS, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409
    assert "venció" in r.json()["detail"]
    assert client.get(f"/api/v1/solicitudes/{radicado}", headers=HEADERS_CANDIDATO).json()["certificados"]["estado"] == "vencidos"

    # El candidato no puede ampliarse el plazo; Gestión Humana sí.
    assert client.post(f"/api/v1/solicitudes/{radicado}/certificados/ampliar-plazo", headers=HEADERS_CANDIDATO).status_code == 403
    r = client.post(f"/api/v1/solicitudes/{radicado}/certificados/ampliar-plazo", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    assert r.json()["certificados"]["estado"] == "pendientes"
    assert r.json()["certificados"]["ampliaciones"] == 1

    r = client.put(f"/api/v1/solicitudes/{radicado}/certificados", json=CERTIFICADOS, headers=HEADERS_CANDIDATO)
    assert r.status_code == 200


def test_rechazado_despues_de_preseleccionar_ya_no_puede_adjuntar():
    radicado = _crear()
    _preseleccionar(radicado)
    client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "Rechazada"}, headers=HEADERS_GESTOR)
    r = client.put(f"/api/v1/solicitudes/{radicado}/certificados", json=CERTIFICADOS, headers=HEADERS_CANDIDATO)
    assert r.status_code == 409


def test_preseleccionar_dos_veces_no_reinicia_el_plazo():
    radicado = _crear()
    primero = _preseleccionar(radicado)["certificados"]["plazo"]
    client.patch(f"/api/v1/solicitudes/{radicado}/estado", json={"estado": "En revisión"}, headers=HEADERS_GESTOR)
    segundo = _preseleccionar(radicado)["certificados"]["plazo"]
    assert primero == segundo
