# ==============================================================
# modulo_candidatos / tests/test_evaluacion_service.py
# Pruebas unitarias directas — evaluar_postulacion() es una función pura,
# no necesita servidor ni base de datos.
# ==============================================================

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.evaluacion_service import evaluar_postulacion

SOLICITUD_BASE = {
    "datos_personales": {"nombreCompleto": "Ana Pérez", "municipio": "Medellín"},
    "registros_ii": [],
    "experiencia": [],
}


def test_sin_criterios_siempre_cumple():
    resultado = evaluar_postulacion(SOLICITUD_BASE, {"criterios": {}})
    assert resultado["cumple"] is True
    assert resultado["motivos"] == []


def test_una_sola_certificacion_requerida_y_cumplida():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "certificacion", "nombreNorma": "Trabajo en alturas"}],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["alturas"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_varias_certificaciones_requeridas_todas_deben_cumplirse():
    # Tiene "alturas" pero le falta "espacios confinados" — no debe cumplir.
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "certificacion", "nombreNorma": "Trabajo en alturas"}],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["alturas", "espacios confinados"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is False
    assert len(resultado["motivos"]) == 1
    assert "espacios confinados" in resultado["motivos"][0]


def test_varias_certificaciones_requeridas_todas_cumplidas():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [
            {"tipo": "certificacion", "nombreNorma": "Trabajo en alturas"},
            {"tipo": "certificacion", "nombreNorma": "Espacios confinados nivel 2"},
        ],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["alturas", "espacios confinados"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_certificacion_tambien_puede_venir_de_curso_o_estudio():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [
            {"tipo": "educacionTrabajo", "nombreEvento": "Curso de soldadura industrial"},
            {"tipo": "estudio", "titulo": "Técnico en mecánica automotriz"},
        ],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["soldadura", "mecánica"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_ciudad_requerida_ya_no_se_evalua_aunque_venga_en_los_criterios():
    # Por compatibilidad hacia atrás: si una vacante vieja todavía tiene
    # "ciudad_requerida" guardada, ya no debe afectar el resultado.
    solicitud = {**SOLICITUD_BASE, "datos_personales": {"municipio": "Bogotá"}}
    vacante = {"criterios": {"ciudad_requerida": "Medellín"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True
    assert resultado["motivos"] == []


def test_experiencia_minima_no_cumplida():
    solicitud = {
        **SOLICITUD_BASE,
        "experiencia": [{"fechaInicio": "2025-01-01", "fechaTerminacion": "2025-06-01"}],  # 5 meses
    }
    vacante = {"criterios": {"experiencia_min_anios": 2}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is False
    assert "experiencia" in resultado["motivos"][0].lower()


def test_experiencia_minima_cumplida_con_trabajo_actual():
    solicitud = {
        **SOLICITUD_BASE,
        "experiencia": [{"fechaInicio": "2020-01-01", "actual": True}],
    }
    vacante = {"criterios": {"experiencia_min_anios": 2}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True
