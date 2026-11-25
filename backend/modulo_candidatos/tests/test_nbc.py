# ==============================================================
# modulo_candidatos / tests/test_nbc.py
# Títulos aceptados + "o afines" por Núcleos Básicos del Conocimiento (NBC).
# ==============================================================

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from tests.conftest import client
from tests.test_solicitudes import HEADERS_CANDIDATO, HEADERS_GESTOR
from app.services.evaluacion_service import evaluar_postulacion
from app.services.nbc_catalogo import clasificar_titulo, listar_nucleos


def _con_titulo(titulo, nivel="Tecnólogo"):
    return {"datos_personales": {}, "experiencia": [],
            "registros_ii": [{"tipo": "estudio", "titulo": titulo, "nivelEducativo": nivel, "graduado": "si"}]}


# Vacante real GTH-FOR-02 (2026-027): "Título técnico o tecnólogo en logística o en
# transporte, o en ramas de la Ingeniería como mecánica automotriz, mecánica industrial o afines."
VACANTE_TECNICO_MANTENIMIENTO = {"criterios": {
    "nivel_educativo_min": "Técnico",
    "titulos_aceptados": ["logística", "transporte", "mecánica automotriz", "mecánica industrial"],
    "acepta_afines": True,
    "nbc_afines": ["831", "69", "833"],
}}


@pytest.mark.parametrize("titulo, codigo", [
    ("Contador Público", "612"),
    ("Administración Financiera", "69"),
    ("Ingeniería Financiera", "821"),       # gana lo más específico
    ("Medicina Veterinaria", "13"),         # no es Medicina
    ("Tecnólogo en Mecánica Industrial", "831"),
    ("Ingeniería Logística", "830"),
    ("Diseño Industrial", "27"),
])
def test_clasificar_titulo(titulo, codigo):
    assert clasificar_titulo(titulo) == [codigo]


def test_titulo_no_reconocido_da_lista_vacia():
    assert clasificar_titulo("Bachiller académico") == []


def test_catalogo_tiene_codigos_unicos_y_area():
    nucleos = listar_nucleos()
    assert len({n["codigo"] for n in nucleos}) == len(nucleos)
    assert all(n["area"] for n in nucleos)


def test_titulo_nombrado_en_la_vacante_cumple_sin_aviso():
    r = evaluar_postulacion(_con_titulo("Técnico en mecánica automotriz", "Técnico"), VACANTE_TECNICO_MANTENIMIENTO)
    assert r["detalle"]["estudios"] == {"cumple": True, "motivo": None, "aviso": None}


def test_titulo_afin_por_nucleo_cumple_con_aviso():
    # "Electromecánica" no está nombrado, pero es del núcleo Ingeniería mecánica y afines.
    r = evaluar_postulacion(_con_titulo("Tecnología en electromecánica"), VACANTE_TECNICO_MANTENIMIENTO)
    assert r["detalle"]["estudios"]["cumple"] is True
    assert "Título afín" in r["detalle"]["estudios"]["aviso"]
    assert "Ingeniería mecánica y afines" in r["detalle"]["estudios"]["aviso"]


def test_titulo_de_otro_nucleo_no_cumple():
    r = evaluar_postulacion(_con_titulo("Tecnología en desarrollo de software"), VACANTE_TECNICO_MANTENIMIENTO)
    assert r["detalle"]["estudios"]["cumple"] is False
    assert "ni a sus afines" in r["detalle"]["estudios"]["motivo"]


def test_sin_o_afines_solo_valen_los_titulos_nombrados():
    vacante = {"criterios": {**VACANTE_TECNICO_MANTENIMIENTO["criterios"], "acepta_afines": False}}
    r = evaluar_postulacion(_con_titulo("Tecnología en electromecánica"), vacante)
    assert r["detalle"]["estudios"]["cumple"] is False


def test_finanzas_o_afines_acepta_contador_si_se_incluye_contaduria():
    vacante = {"criterios": {"titulos_aceptados": ["Finanzas"], "acepta_afines": True, "nbc_afines": ["69", "611", "612"]}}
    r = evaluar_postulacion(_con_titulo("Contaduría Pública", "Universitario"), vacante)
    assert r["detalle"]["estudios"]["cumple"] is True
    assert "Contaduría pública" in r["detalle"]["estudios"]["aviso"]


def test_finanzas_o_afines_sin_contaduria_no_acepta_contador():
    vacante = {"criterios": {"titulos_aceptados": ["Finanzas"], "acepta_afines": True, "nbc_afines": ["69", "611"]}}
    r = evaluar_postulacion(_con_titulo("Contaduría Pública", "Universitario"), vacante)
    assert r["detalle"]["estudios"]["cumple"] is False


def test_titulo_no_reconocido_pide_revision_manual():
    r = evaluar_postulacion(_con_titulo("Bachiller académico"), VACANTE_TECNICO_MANTENIMIENTO)
    assert "revisar a mano" in r["detalle"]["estudios"]["motivo"]


def test_vacante_vieja_con_palabra_clave_sigue_funcionando():
    vacante = {"criterios": {"profesion_keyword": "Ingeniería Civil"}}
    assert evaluar_postulacion(_con_titulo("Ingeniero Civil", "Universitario"), vacante)["cumple"] is True


def test_rutas_del_catalogo_solo_para_gestion_humana():
    assert client.get("/api/v1/catalogos/nbc", headers=HEADERS_CANDIDATO).status_code == 403
    r = client.get("/api/v1/catalogos/nbc", headers=HEADERS_GESTOR)
    assert r.status_code == 200 and any(n["codigo"] == "612" for n in r.json())
    r = client.get("/api/v1/catalogos/nbc/clasificar", params={"titulo": "Mecánica automotriz"}, headers=HEADERS_GESTOR)
    assert r.json() == {"codigos": ["831"]}
