# ==============================================================
# modulo_candidatos / tests/test_reporte.py
# ==============================================================

import os
import sys
import io
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import openpyxl
import pytest

from tests.conftest import client
from tests.test_solicitudes import HEADERS_CANDIDATO, HEADERS_GESTOR, SOLICITUD_VALIDA
from app.services import reporte_service

pytestmark = pytest.mark.usefixtures("mock_vacantes")


class _FakeSolicitud:
    pass


def _solicitud_fake(**kwargs):
    s = _FakeSolicitud()
    s.datos_personales = kwargs.get("datos_personales", {"cedula": "123", "nombreCompleto": "Ana Prueba", "correo": "ana@example.com"})
    s.registros_ii = kwargs.get("registros_ii", [])
    s.experiencia = kwargs.get("experiencia", [])
    s.conflicto = kwargs.get("conflicto", {})
    s.fecha_solicitud = kwargs.get("fecha_solicitud", datetime(2026, 8, 5, tzinfo=timezone.utc))
    s.evaluacion = kwargs.get("evaluacion", None)
    return s


def test_traspaso_marca_x_en_columna_si_cuando_categoria_cumple():
    s = _solicitud_fake(evaluacion={"cumple": True, "motivos": [], "detalle": {
        "estudios": {"cumple": True, "motivo": None},
        "conocimientos": {"cumple": None, "motivo": None},
        "experiencia": {"cumple": True, "motivo": None},
    }})
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "1", "cargo": "C"}, [s])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Traspaso_a_FOR-04"]
    assert ws["C7"].value == "X"  # Estudios - SI
    assert ws["D7"].value is None
    assert ws["G7"].value == "X"  # Experiencia - SI
    assert ws["E7"].value is None  # Conocimientos: sin criterio, queda en blanco
    assert ws["F7"].value is None


def test_traspaso_marca_x_en_columna_no_cuando_categoria_no_cumple():
    s = _solicitud_fake(evaluacion={"cumple": False, "motivos": ["algo"], "detalle": {
        "estudios": {"cumple": False, "motivo": "No cumple nivel"},
        "conocimientos": {"cumple": None, "motivo": None},
        "experiencia": {"cumple": None, "motivo": None},
    }})
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "1", "cargo": "C"}, [s])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Traspaso_a_FOR-04"]
    assert ws["D7"].value == "X"  # Estudios - NO
    assert ws["C7"].value is None


def test_traspaso_no_marca_decision_automaticamente():
    s = _solicitud_fake(evaluacion={"cumple": True, "motivos": [], "detalle": {
        "estudios": {"cumple": True, "motivo": None},
        "conocimientos": {"cumple": True, "motivo": None},
        "experiencia": {"cumple": True, "motivo": None},
    }})
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "1", "cargo": "C"}, [s])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Traspaso_a_FOR-04"]
    assert ws["I7"].value is None  # Admitido — nunca automático
    assert ws["J7"].value is None  # Rechazado — nunca automático


def test_traspaso_sin_evaluacion_queda_todo_en_blanco():
    s = _solicitud_fake(evaluacion=None)
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "1", "cargo": "C"}, [s])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Traspaso_a_FOR-04"]
    for col in ["C", "D", "E", "F", "G", "H"]:
        assert ws[f"{col}7"].value is None


def test_generar_reporte_produce_un_xlsx_valido():
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "2026-1", "cargo": "Analista"}, [_solicitud_fake()])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    assert wb.sheetnames == ["Aspirantes", "Traspaso_a_FOR-04", "Listas"]


def test_reporte_no_arrastra_los_datos_de_ejemplo_de_la_plantilla():
    contenido = reporte_service.generar_reporte_vacante(
        {"proceso_no": "2026-1", "cargo": "Analista"},
        [_solicitud_fake(datos_personales={"cedula": "999", "nombreCompleto": "Pedro Real", "correo": "pedro@example.com"})],
    )
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Aspirantes"]
    assert ws["A7"].value == "999"
    assert ws["C7"].value == "Pedro Real"
    assert ws["B7"].value is None
    assert ws["BT7"].value is None


def test_reporte_pone_el_proceso_y_cargo_reales_en_el_encabezado():
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "2026-XYZ", "cargo": "Ingeniero de Planta"}, [_solicitud_fake()])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Aspirantes"]
    assert "2026-XYZ" in ws["A3"].value
    assert "Ingeniero de Planta" in ws["A3"].value


def test_reporte_una_fila_por_solicitud_en_orden():
    solicitudes = [
        _solicitud_fake(datos_personales={"cedula": "111", "nombreCompleto": "Primero"}),
        _solicitud_fake(datos_personales={"cedula": "222", "nombreCompleto": "Segundo"}),
        _solicitud_fake(datos_personales={"cedula": "333", "nombreCompleto": "Tercero"}),
    ]
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "2026-1", "cargo": "Analista"}, solicitudes)
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Aspirantes"]
    assert ws["A7"].value == "111"
    assert ws["A8"].value == "222"
    assert ws["A9"].value == "333"
    assert ws["A10"].value is None


def test_reporte_mapea_si_no_correctamente():
    s = _solicitud_fake(datos_personales={"cedula": "1", "nombreCompleto": "X", "licencia": "si", "tieneVehiculo": "no"})
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "1", "cargo": "C"}, [s])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Aspirantes"]
    assert ws["L7"].value == "SI"
    assert ws["N7"].value == "NO"


def test_reporte_toma_el_estudio_de_nivel_mas_alto():
    s = _solicitud_fake(registros_ii=[
        {"tipo": "estudio", "nivelEducativo": "Técnico", "titulo": "Técnico en Algo"},
        {"tipo": "estudio", "nivelEducativo": "Universitario", "titulo": "Ingeniero"},
        {"tipo": "estudio", "nivelEducativo": "Secundarios", "titulo": "Bachiller"},
    ])
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "1", "cargo": "C"}, [s])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Aspirantes"]
    assert ws["X7"].value == "Universitario"
    assert ws["Y7"].value == "Ingeniero"


def test_reporte_conflicto_de_interes():
    s = _solicitud_fake(conflicto={
        "tieneVinculo": "si",
        "familiares": [{"parentesco": "Hermano", "nombreEmpleado": "Juan Pérez", "cargo": "Jefe de Planta"}],
    })
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "1", "cargo": "C"}, [s])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Aspirantes"]
    assert ws["BM7"].value == "SI"
    assert ws["BN7"].value == "Hermano"
    assert ws["BO7"].value == "Juan Pérez"


def test_reporte_experiencia_actual_usa_fecha_de_hoy_para_calcular():
    s = _solicitud_fake(experiencia=[{"empresa": "Empresa X", "cargo": "Cargo X", "fechaInicio": "2020-01-01", "actual": True}])
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "1", "cargo": "C"}, [s])
    wb = openpyxl.load_workbook(io.BytesIO(contenido))
    ws = wb["Aspirantes"]
    assert ws["AO7"].value == "Empresa X"
    assert ws["AS7"].value is not None


def test_reporte_no_tiene_errores_de_formula_tras_recalcular(tmp_path):
    import subprocess
    import json

    solicitudes = [_solicitud_fake(datos_personales={"cedula": str(i), "nombreCompleto": f"Persona {i}"}) for i in range(5)]
    contenido = reporte_service.generar_reporte_vacante({"proceso_no": "2026-1", "cargo": "Analista"}, solicitudes)
    ruta = tmp_path / "reporte.xlsx"
    ruta.write_bytes(contenido)

    resultado = subprocess.run(
        ["python3", "/mnt/skills/public/xlsx/scripts/recalc.py", str(ruta)],
        capture_output=True, text=True, timeout=60,
    )
    salida = json.loads(resultado.stdout)
    assert salida["status"] == "success"
    assert salida["total_errors"] == 0


def test_descargar_reporte_requiere_rol_gestion():
    r = client.get("/api/v1/solicitudes/admin/reporte/vac-1", headers=HEADERS_CANDIDATO)
    assert r.status_code == 403


def test_descargar_reporte_vacante_inexistente_da_404():
    r = client.get("/api/v1/solicitudes/admin/reporte/no-existe", headers=HEADERS_GESTOR)
    assert r.status_code == 404


def test_descargar_reporte_devuelve_un_xlsx_valido():
    client.post("/api/v1/solicitudes", json=SOLICITUD_VALIDA, headers=HEADERS_CANDIDATO)

    r = client.get("/api/v1/solicitudes/admin/reporte/vac-1", headers=HEADERS_GESTOR)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "attachment" in r.headers["content-disposition"]

    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    ws = wb["Aspirantes"]
    assert ws["A7"].value == SOLICITUD_VALIDA["datos_personales"]["cedula"]
