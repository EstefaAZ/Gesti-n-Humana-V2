# ==============================================================
# modulo_vacantes / tests/test_vacantes.py
# ==============================================================

import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.config import settings
from app.main import app

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def token_para(rol: str, sub: str = "user-123", nombre: str = "Ana Gestora") -> str:
    """Simula el token que emitiría el módulo Login (mismo SECRET_KEY/ALGORITHM)."""
    payload = {"sub": sub, "rol": rol, "email": f"{sub}@example.com", "nombre": nombre}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


HEADERS_GESTOR = {"Authorization": f"Bearer {token_para('gestor_humano')}"}
HEADERS_CANDIDATO = {"Authorization": f"Bearer {token_para('candidato')}"}
HEADERS_ADMIN = {"Authorization": f"Bearer {token_para('admin')}"}

VACANTE_VALIDA = {
    "proceso_no": "2026-014",
    "cargo": "Analista de Gestión Humana",
    "area": "Talento Humano",
    "plazas": 1,
    "criterios": {
        "nivel_educativo_min": "Universitario",
        "graduado_requerido": True,
        "experiencia_min_anios": 2,
    },
}


def test_health_check():
    assert client.get("/health").json()["estado"] == "saludable"


def test_listar_publicas_vacio_al_inicio():
    r = client.get("/api/v1/vacantes")
    assert r.status_code == 200
    assert r.json() == []


def test_crear_vacante_sin_token_es_rechazada():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA)
    assert r.status_code == 401


def test_crear_vacante_con_rol_candidato_es_rechazada():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_CANDIDATO)
    assert r.status_code == 403


def test_crear_vacante_con_rol_gestor_humano_exitoso():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    assert r.status_code == 201
    data = r.json()
    assert data["cargo"] == VACANTE_VALIDA["cargo"]
    assert data["criterios"]["experiencia_min_anios"] == 2
    assert data["esta_cerrada"] is False
    assert data["creada_por_nombre"] == "Ana Gestora"


def test_vacante_en_borrador_no_aparece_en_listado_publico_pero_si_en_admin():
    r = client.post("/api/v1/vacantes", json={**VACANTE_VALIDA, "estado": "borrador"}, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]

    r_publico = client.get("/api/v1/vacantes")
    assert all(v["id"] != vacante_id for v in r_publico.json())

    r_admin = client.get("/api/v1/vacantes/admin/todas", headers=HEADERS_GESTOR)
    assert any(v["id"] == vacante_id for v in r_admin.json())

    r_detalle_publico = client.get(f"/api/v1/vacantes/{vacante_id}")
    assert r_detalle_publico.status_code == 404


def test_solo_publicada_y_cerrada_son_visibles_para_candidatos():
    ids_ocultos = []
    for estado in ("borrador", "en_proceso", "cancelada_desierta"):
        r = client.post("/api/v1/vacantes", json={**VACANTE_VALIDA, "estado": estado}, headers=HEADERS_GESTOR)
        ids_ocultos.append(r.json()["id"])

    r_publicada = client.post("/api/v1/vacantes", json={**VACANTE_VALIDA, "estado": "publicada"}, headers=HEADERS_GESTOR)
    r_cerrada = client.post("/api/v1/vacantes", json={**VACANTE_VALIDA, "estado": "cerrada"}, headers=HEADERS_GESTOR)

    ids_publico = {v["id"] for v in client.get("/api/v1/vacantes").json()}
    assert r_publicada.json()["id"] in ids_publico
    assert r_cerrada.json()["id"] in ids_publico
    for id_oculto in ids_ocultos:
        assert id_oculto not in ids_publico


def test_admin_todas_requiere_rol_gestion():
    r = client.get("/api/v1/vacantes/admin/todas", headers=HEADERS_CANDIDATO)
    assert r.status_code == 403


def test_actualizar_vacante():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]

    datos_actualizados = {**VACANTE_VALIDA, "cargo": "Analista Senior de Gestión Humana"}
    r2 = client.put(f"/api/v1/vacantes/{vacante_id}", json=datos_actualizados, headers=HEADERS_GESTOR)
    assert r2.status_code == 200
    assert r2.json()["cargo"] == "Analista Senior de Gestión Humana"


def test_cambiar_estado():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]
    assert r.json()["estado"] == "publicada"  # valor por defecto

    r2 = client.patch(f"/api/v1/vacantes/{vacante_id}/estado", json={"estado": "en_proceso"}, headers=HEADERS_GESTOR)
    assert r2.status_code == 200
    assert r2.json()["estado"] == "en_proceso"

    r3 = client.patch(f"/api/v1/vacantes/{vacante_id}/estado", json={"estado": "cerrada"}, headers=HEADERS_GESTOR)
    assert r3.json()["estado"] == "cerrada"


def test_cambiar_estado_rechaza_valor_invalido():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]
    r2 = client.patch(f"/api/v1/vacantes/{vacante_id}/estado", json={"estado": "no_existe"}, headers=HEADERS_GESTOR)
    assert r2.status_code == 422


def test_cambiar_estado_requiere_rol_gestion():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]
    r2 = client.patch(f"/api/v1/vacantes/{vacante_id}/estado", json={"estado": "cerrada"}, headers=HEADERS_CANDIDATO)
    assert r2.status_code == 403


def test_eliminar_vacante():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]

    r2 = client.delete(f"/api/v1/vacantes/{vacante_id}", headers=HEADERS_GESTOR)
    assert r2.status_code == 204

    r3 = client.get(f"/api/v1/vacantes/admin/{vacante_id}", headers=HEADERS_GESTOR)
    assert r3.status_code == 404


def test_vacante_con_fecha_cierre_pasada_se_detecta_cerrada():
    ayer = (date.today() - timedelta(days=1)).isoformat()
    datos = {**VACANTE_VALIDA, "fecha_cierre": ayer, "hora_cierre": "16:00"}
    r = client.post("/api/v1/vacantes", json=datos, headers=HEADERS_GESTOR)
    assert r.json()["esta_cerrada"] is True


def test_vacante_con_fecha_cierre_futura_no_esta_cerrada():
    manana = (date.today() + timedelta(days=1)).isoformat()
    datos = {**VACANTE_VALIDA, "fecha_cierre": manana}
    r = client.post("/api/v1/vacantes", json=datos, headers=HEADERS_GESTOR)
    assert r.json()["esta_cerrada"] is False


def test_estadisticas_requiere_rol_gestion():
    r = client.get("/api/v1/vacantes/admin/estadisticas", headers=HEADERS_CANDIDATO)
    assert r.status_code == 403


def test_estadisticas_devuelve_conteos_reales():
    ayer = (date.today() - timedelta(days=1)).isoformat()
    manana = (date.today() + timedelta(days=1)).isoformat()

    client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)  # publicada, abierta
    client.post("/api/v1/vacantes", json={**VACANTE_VALIDA, "estado": "borrador"}, headers=HEADERS_GESTOR)  # no publicada
    client.post("/api/v1/vacantes", json={**VACANTE_VALIDA, "fecha_cierre": ayer}, headers=HEADERS_GESTOR)  # cerrada por fecha
    client.post("/api/v1/vacantes", json={**VACANTE_VALIDA, "fecha_cierre": manana}, headers=HEADERS_GESTOR)  # abierta

    r = client.get("/api/v1/vacantes/admin/estadisticas", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 4
    assert data["activas"] == 3  # publicada (las 3 que no son "borrador")
    assert data["ocultas"] == 1
    assert data["cerradas"] == 1
    assert data["abiertas"] == 3
    assert len(data["recientes"]) <= 5


def test_auditoria_requiere_rol_admin_no_solo_gestion():
    r = client.get("/api/v1/vacantes/admin/auditoria/eventos", headers=HEADERS_GESTOR)
    assert r.status_code == 403  # gestor_humano no basta, esto es solo para admin

    r_candidato = client.get("/api/v1/vacantes/admin/auditoria/eventos", headers=HEADERS_CANDIDATO)
    assert r_candidato.status_code == 403


def test_auditoria_registra_creacion_edicion_cambio_estado_y_eliminar():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]

    client.put(f"/api/v1/vacantes/{vacante_id}", json={**VACANTE_VALIDA, "cargo": "Cargo Editado"}, headers=HEADERS_GESTOR)
    client.patch(f"/api/v1/vacantes/{vacante_id}/estado", json={"estado": "borrador"}, headers=HEADERS_GESTOR)
    client.delete(f"/api/v1/vacantes/{vacante_id}", headers=HEADERS_GESTOR)

    r_auditoria = client.get("/api/v1/vacantes/admin/auditoria/eventos", headers=HEADERS_ADMIN)
    assert r_auditoria.status_code == 200
    tipos = [e["tipo"] for e in r_auditoria.json()]
    assert "vacante_creada" in tipos
    assert "vacante_actualizada" in tipos
    assert "vacante_cambio_estado" in tipos
    assert "vacante_eliminada" in tipos


def test_auditoria_describe_el_estado_nuevo():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]

    client.patch(f"/api/v1/vacantes/{vacante_id}/estado", json={"estado": "cancelada_desierta"}, headers=HEADERS_GESTOR)

    r_auditoria = client.get("/api/v1/vacantes/admin/auditoria/eventos", headers=HEADERS_ADMIN)
    evento = next(e for e in r_auditoria.json() if e["tipo"] == "vacante_cambio_estado")
    assert "cancelada_desierta" in evento["descripcion"]


def test_permite_hasta_5_certificaciones_requeridas():
    datos = {**VACANTE_VALIDA, "criterios": {**VACANTE_VALIDA["criterios"], "certificaciones_keywords": ["SST", "Alturas", "Espacios confinados", "Soldadura", "Manejo defensivo"]}}
    r = client.post("/api/v1/vacantes", json=datos, headers=HEADERS_GESTOR)
    assert r.status_code == 201
    assert len(r.json()["criterios"]["certificaciones_keywords"]) == 5


def test_rechaza_mas_de_5_certificaciones_requeridas():
    datos = {**VACANTE_VALIDA, "criterios": {**VACANTE_VALIDA["criterios"], "certificaciones_keywords": ["a", "b", "c", "d", "e", "f"]}}
    r = client.post("/api/v1/vacantes", json=datos, headers=HEADERS_GESTOR)
    assert r.status_code == 422


def test_subir_documento_pdf_y_descargarlo():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]
    assert r.json()["tiene_documento_pdf"] is False

    pdf_falso = b"%PDF-1.4 contenido de prueba"
    r_subir = client.post(
        f"/api/v1/vacantes/{vacante_id}/documento",
        files={"archivo": ("convocatoria.pdf", pdf_falso, "application/pdf")},
        headers=HEADERS_GESTOR,
    )
    assert r_subir.status_code == 200
    assert r_subir.json()["tiene_documento_pdf"] is True

    r_descarga = client.get(f"/api/v1/vacantes/{vacante_id}/documento")
    assert r_descarga.status_code == 200
    assert r_descarga.content == pdf_falso
    assert r_descarga.headers["content-type"] == "application/pdf"


def test_subir_documento_rechaza_archivos_que_no_son_pdf():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]
    r_subir = client.post(
        f"/api/v1/vacantes/{vacante_id}/documento",
        files={"archivo": ("nota.txt", b"hola", "text/plain")},
        headers=HEADERS_GESTOR,
    )
    assert r_subir.status_code == 400


def test_subir_documento_requiere_rol_gestion():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]
    r_subir = client.post(
        f"/api/v1/vacantes/{vacante_id}/documento",
        files={"archivo": ("convocatoria.pdf", b"%PDF-1.4", "application/pdf")},
        headers=HEADERS_CANDIDATO,
    )
    assert r_subir.status_code == 403


def test_descargar_documento_de_vacante_no_visible_da_404():
    r = client.post("/api/v1/vacantes", json={**VACANTE_VALIDA, "estado": "borrador"}, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]
    client.post(
        f"/api/v1/vacantes/{vacante_id}/documento",
        files={"archivo": ("convocatoria.pdf", b"%PDF-1.4", "application/pdf")},
        headers=HEADERS_GESTOR,
    )
    r_descarga = client.get(f"/api/v1/vacantes/{vacante_id}/documento")
    assert r_descarga.status_code == 404  # candidato no puede ver el PDF de un borrador


def test_descargar_documento_sin_subir_da_404():
    r = client.post("/api/v1/vacantes", json=VACANTE_VALIDA, headers=HEADERS_GESTOR)
    vacante_id = r.json()["id"]
    r_descarga = client.get(f"/api/v1/vacantes/{vacante_id}/documento")
    assert r_descarga.status_code == 404
