# ==============================================================
# modulo_candidatos / tests/test_evaluacion_service.py
# Pruebas unitarias directas — evaluar_postulacion() es una función pura,
# no necesita servidor ni base de datos.
# ==============================================================

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.evaluacion_service import evaluar_postulacion, _formatear_anios_a_texto

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


# ---------------------------------------------------------------
# certificaciones_keywords: variantes de espaciado/guion en nombres
# compuestos ("Power BI" / "PowerBI" / "Power-BI", "ISO 9001" / "ISO9001").
# ---------------------------------------------------------------

def test_certificacion_keyword_con_espacio_vs_texto_sin_espacio():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "certificacion", "nombreNorma": "Certificacion Microsoft PowerBI"}],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["Power BI"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_certificacion_keyword_con_espacio_vs_texto_con_guion():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "certificacion", "nombreNorma": "Certificacion Microsoft Power-BI"}],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["Power BI"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_certificacion_keyword_sin_espacio_vs_texto_con_espacio():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "certificacion", "nombreNorma": "Certificacion Microsoft Power BI"}],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["PowerBI"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_certificacion_keyword_con_espacio_vs_texto_sin_espacio_iso():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "certificacion", "nombreNorma": "Auditor Interno ISO9001"}],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["ISO 9001"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_certificacion_keyword_con_espacio_vs_texto_con_guion_iso():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "certificacion", "nombreNorma": "Auditor Interno ISO-9001"}],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["ISO 9001"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_certificacion_keyword_sin_espacio_vs_texto_con_espacio_iso():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "certificacion", "nombreNorma": "Auditor Interno ISO 9001"}],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["ISO9001"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_certificacion_no_confunde_iso_9001_con_iso_14001():
    # Guardia explícita: el ventaneo de tokens compara por igualdad exacta,
    # no por substring dentro de un texto compactado — así "ISO 9001" nunca
    # matchea "ISO 14001" aunque ambos empiecen igual.
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "certificacion", "nombreNorma": "Auditor Interno ISO 14001"}],
    }
    vacante = {"criterios": {"certificaciones_keywords": ["ISO 9001"]}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is False


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


def test_experiencia_solapada_no_duplica_el_tiempo():
    # Dos registros con el MISMO periodo de 3 años (duplicado, o dos empleos
    # simultáneos): el tiempo real transcurrido es 3 años, no 6. Con un
    # mínimo de 4 años, debe marcar NO CUMPLE — la suma nominal (6) hubiera
    # cumplido, pero el tiempo real fusionado (3) no.
    solicitud = {
        **SOLICITUD_BASE,
        "experiencia": [
            {"fechaInicio": "2020-01-01", "fechaTerminacion": "2023-01-01"},
            {"fechaInicio": "2020-01-01", "fechaTerminacion": "2023-01-01"},
        ],
    }
    vacante = {"criterios": {"experiencia_min_anios": 4}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is False


def test_experiencia_no_solapada_se_sigue_sumando_normal():
    # Sin solapamiento, el resultado debe seguir siendo la suma de ambas
    # experiencias — el cambio no debe afectar el caso común.
    solicitud = {
        **SOLICITUD_BASE,
        "experiencia": [
            {"fechaInicio": "2018-01-01", "fechaTerminacion": "2019-01-01"},
            {"fechaInicio": "2019-06-01", "fechaTerminacion": "2020-06-01"},
        ],
    }
    vacante = {"criterios": {"experiencia_min_anios": 2}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


# ---------------------------------------------------------------
# _formatear_anios_a_texto: casos límite puros de la función de formato.
# ---------------------------------------------------------------

def test_formatear_anios_cero_da_cero_meses():
    assert _formatear_anios_a_texto(0.0) == "0 meses"


def test_formatear_anios_doce_meses_exactos_da_un_anio():
    # Nunca debe mostrarse "0 años y 12 meses".
    assert _formatear_anios_a_texto(1.0) == "1 año"


def test_formatear_anios_singular_y_plural():
    assert _formatear_anios_a_texto(1 / 12) == "1 mes"
    assert _formatear_anios_a_texto(2 / 12) == "2 meses"
    assert _formatear_anios_a_texto(1.0) == "1 año"
    assert _formatear_anios_a_texto(2.0) == "2 años"


def test_formatear_anios_con_anios_y_meses():
    assert _formatear_anios_a_texto(1 + 4 / 12) == "1 año y 4 meses"
    assert _formatear_anios_a_texto(2.5) == "2 años y 6 meses"


# ---------------------------------------------------------------
# Mensaje de experiencia_min_anios en texto natural (años/meses), integrado
# con evaluar_postulacion().
# ---------------------------------------------------------------

def test_motivo_experiencia_se_muestra_en_meses_cuando_es_menos_de_un_anio():
    # Caso de la captura original: ~11 meses reales, mínimo 2 años.
    solicitud = {
        **SOLICITUD_BASE,
        "experiencia": [{"fechaInicio": "2024-01-01", "fechaTerminacion": "2024-12-01"}],
    }
    vacante = {"criterios": {"experiencia_min_anios": 2}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is False
    assert "Registra 11 meses de experiencia; se requieren mínimo 2 años." in resultado["motivos"]


def test_motivo_experiencia_muestra_anios_y_meses_en_ambos_lados():
    solicitud = {
        **SOLICITUD_BASE,
        "experiencia": [{"fechaInicio": "2020-01-01", "fechaTerminacion": "2021-05-20"}],  # ~1 año y 4 meses
    }
    vacante = {"criterios": {"experiencia_min_anios": 2.5}}  # 2 años y 6 meses
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is False
    assert "Registra 1 año y 4 meses de experiencia; se requieren mínimo 2 años y 6 meses." in resultado["motivos"]


def test_truncamiento_evita_mensaje_contradictorio_cerca_del_limite():
    # ~1.97 años reales (23 meses truncados): si el mensaje redondeara en vez
    # de truncar, mostraría "2 años" en el lado del candidato pese a que
    # cumple=False — con truncamiento debe decir "1 año y 11 meses", nunca
    # "2 años" del lado que NO cumple.
    solicitud = {
        **SOLICITUD_BASE,
        "experiencia": [{"fechaInicio": "2020-01-01", "fechaTerminacion": "2021-12-20"}],
    }
    vacante = {"criterios": {"experiencia_min_anios": 2}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is False
    motivo = resultado["motivos"][0]
    lado_candidato = motivo.split(";")[0]
    assert "1 año y 11 meses" in lado_candidato
    assert "2 años" not in lado_candidato


# ---------------------------------------------------------------
# Desglose por categoría (detalle) — lo usa el reporte GTH-FOR-03
# ---------------------------------------------------------------

def test_detalle_sin_criterios_configurados_queda_todo_en_none():
    resultado = evaluar_postulacion(SOLICITUD_BASE, {"criterios": {}})
    assert resultado["detalle"]["estudios"]["cumple"] is None
    assert resultado["detalle"]["conocimientos"]["cumple"] is None
    assert resultado["detalle"]["experiencia"]["cumple"] is None


def test_detalle_estudios_cumple():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "estudio", "nivelEducativo": "Universitario", "graduado": "si"}]}
    vacante = {"criterios": {"nivel_educativo_min": "Técnico"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["estudios"]["cumple"] is True
    assert resultado["detalle"]["estudios"]["motivo"] is None


def test_detalle_estudios_no_cumple():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "estudio", "nivelEducativo": "Secundarios", "graduado": "si"}]}
    vacante = {"criterios": {"nivel_educativo_min": "Universitario"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["estudios"]["cumple"] is False
    assert resultado["detalle"]["estudios"]["motivo"] is not None


def test_detalle_experiencia_independiente_de_estudios():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "estudio", "nivelEducativo": "Universitario", "graduado": "si"}],
        "experiencia": [{"fechaInicio": "2024-01-01", "fechaTerminacion": "2024-06-01"}],  # 5 meses
    }
    vacante = {"criterios": {"nivel_educativo_min": "Universitario", "experiencia_min_anios": 3}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["estudios"]["cumple"] is True
    assert resultado["detalle"]["experiencia"]["cumple"] is False


def test_detalle_profesion_va_en_estudios_e_idioma_en_conocimientos():
    solicitud = {
        **SOLICITUD_BASE,
        "datos_personales": {**SOLICITUD_BASE["datos_personales"], "profesion": "Ingeniero Ambiental"},
        "registros_ii": [{"tipo": "idioma", "idioma": "Inglés", "nivel": "Experto"}],
    }
    vacante = {"criterios": {
        "profesion_keyword": "ambiental",
        "idioma_requerido": "Inglés", "idioma_nivel_min": "Avanzado",
    }}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["estudios"]["cumple"] is True  # la profesión es parte de Estudios (GTH-FOR-04)
    assert resultado["detalle"]["conocimientos"]["cumple"] is True  # idioma


def test_detalle_conocimientos_no_cumple_si_falla_uno_de_varios_criterios():
    solicitud = {
        **SOLICITUD_BASE,
        "datos_personales": {**SOLICITUD_BASE["datos_personales"], "profesion": "Ingeniero Ambiental"},
        "registros_ii": [],  # sin idioma registrado
    }
    vacante = {"criterios": {
        "profesion_keyword": "ambiental",  # esto sí cumple
        "idioma_requerido": "Inglés", "idioma_nivel_min": "Avanzado",  # esto NO cumple
    }}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["conocimientos"]["cumple"] is False


# ---------------------------------------------------------------
# profesion_keyword: tolerancia a tildes y a variaciones de género/número
# ("ingeniero"/"ingeniera" deben cumplir un criterio escrito "ingenieria").
# Caso real reportado: Valentina Restrepo Zuluaga (SOL-2026-93130).
# ---------------------------------------------------------------

def test_profesion_con_genero_distinto_al_del_keyword_si_cumple():
    solicitud = {
        **SOLICITUD_BASE,
        "datos_personales": {**SOLICITUD_BASE["datos_personales"], "profesion": "Ingeniera Industrial"},
        "registros_ii": [{"tipo": "estudio", "titulo": "Especializacion en Analitica de Datos"}],
    }
    vacante = {"criterios": {"profesion_keyword": "ingenieria"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True
    assert resultado["motivos"] == []


def test_profesion_keyword_sin_tilde_cumple_titulo_con_tilde():
    solicitud = {
        **SOLICITUD_BASE,
        "registros_ii": [{"tipo": "estudio", "titulo": "Ingeniería Industrial"}],
    }
    vacante = {"criterios": {"profesion_keyword": "ingenieria"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


def test_profesion_keyword_no_cumple_si_no_hay_relacion_real():
    solicitud = {
        **SOLICITUD_BASE,
        "datos_personales": {**SOLICITUD_BASE["datos_personales"], "profesion": "Contadora Pública"},
        "registros_ii": [{"tipo": "estudio", "titulo": "Especializacion en Analitica de Datos"}],
    }
    vacante = {"criterios": {"profesion_keyword": "ingenieria"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is False
    assert "ingenieria" in resultado["motivos"][0]


def test_idioma_nivel_superior_del_candidato_cumple_un_minimo_inferior():
    # Caso reportado: la vacante exige "Avanzado", el candidato tiene "Experto" — debe cumplir.
    solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "idioma", "idioma": "Inglés", "nivel": "Experto"}]}
    vacante = {"criterios": {"idioma_requerido": "Inglés", "idioma_nivel_min": "Avanzado"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["conocimientos"]["cumple"] is True


def test_idioma_nivel_inferior_del_candidato_no_cumple():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "idioma", "idioma": "Inglés", "nivel": "Básico"}]}
    vacante = {"criterios": {"idioma_requerido": "Inglés", "idioma_nivel_min": "Avanzado"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["conocimientos"]["cumple"] is False


def test_idioma_sin_registrar_no_cumple():
    vacante = {"criterios": {"idioma_requerido": "Inglés", "idioma_nivel_min": "Básico"}}
    resultado = evaluar_postulacion(SOLICITUD_BASE, vacante)
    assert resultado["detalle"]["conocimientos"]["cumple"] is False


def test_idioma_vale_el_mejor_de_varios_registros_del_mismo_idioma():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [
        {"tipo": "idioma", "idioma": "Inglés", "nivel": "Básico"},
        {"tipo": "idioma", "idioma": "Inglés", "nivel": "Avanzado"},
    ]}
    vacante = {"criterios": {"idioma_requerido": "Inglés", "idioma_nivel_min": "Intermedio"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["conocimientos"]["cumple"] is True


# ---------------------------------------------------------------
# Compatibilidad con la escala anterior (Lo habla / Lo lee / Lo escribe)
# ---------------------------------------------------------------

def test_registro_con_escala_anterior_se_traduce_a_la_nueva():
    # "Muy bien" equivale a "Avanzado": un registro viejo no puede quedar descartado.
    solicitud = {**SOLICITUD_BASE, "registros_ii": [
        {"tipo": "idioma", "idioma": "Inglés", "habla": "Muy bien", "lee": "Bien", "escribe": "Regular"},
    ]}
    vacante = {"criterios": {"idioma_requerido": "Inglés", "idioma_nivel_min": "Avanzado"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["conocimientos"]["cumple"] is True


def test_criterio_de_vacante_con_escala_anterior_sigue_evaluandose():
    # Vacante creada antes del cambio: "Bien" equivale a "Intermedio".
    solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "idioma", "idioma": "Inglés", "nivel": "Avanzado"}]}
    vacante = {"criterios": {"idioma_requerido": "Inglés", "idioma_nivel_min": "Bien"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["conocimientos"]["cumple"] is True


def test_idioma_habilidad_de_vacantes_viejas_se_ignora_sin_romper():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "idioma", "idioma": "Inglés", "nivel": "Avanzado"}]}
    vacante = {"criterios": {
        "idioma_requerido": "Inglés", "idioma_nivel_min": "Bien", "idioma_habilidad": "escribe",
    }}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True


# ---------------------------------------------------------------
# Los requisitos son mínimos, nunca valores exactos
# ---------------------------------------------------------------

def test_todo_nivel_educativo_superior_cumple_el_minimo():
    vacante = {"criterios": {"nivel_educativo_min": "Técnico"}}
    for nivel in ("Técnico", "Tecnólogo", "Universitario", "Postgrado"):
        solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "estudio", "nivelEducativo": nivel, "graduado": "si"}]}
        assert evaluar_postulacion(solicitud, vacante)["detalle"]["estudios"]["cumple"] is True, nivel


def test_nivel_educativo_escrito_sin_tildes_o_como_sinonimo_no_descarta():
    vacante = {"criterios": {"nivel_educativo_min": "Universitario"}}
    for nivel in ("Postgrado", "posgrado", "Maestria", "Doctorado"):
        solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "estudio", "nivelEducativo": nivel, "graduado": "si"}]}
        assert evaluar_postulacion(solicitud, vacante)["detalle"]["estudios"]["cumple"] is True, nivel


def test_el_motivo_de_estudios_deja_claro_que_es_un_minimo():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "estudio", "nivelEducativo": "Secundarios", "graduado": "si"}]}
    vacante = {"criterios": {"nivel_educativo_min": "Universitario"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert "o superior" in resultado["detalle"]["estudios"]["motivo"]


def test_detalle_no_afecta_el_resultado_general_cumple_motivos():
    # El resultado general (para el badge del panel) debe seguir funcionando exactamente igual.
    solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "estudio", "nivelEducativo": "Universitario", "graduado": "si"}]}
    vacante = {"criterios": {"nivel_educativo_min": "Universitario"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["cumple"] is True
    assert resultado["motivos"] == []


# ---------------------------------------------------------------
# Revisión de la evaluación (noviembre 2026)
# ---------------------------------------------------------------
from datetime import date, timedelta
from app.services.evaluacion_service import _texto_incluye_keyword, _total_experiencia_anios


def _estudio(titulo, nivel="Universitario", graduado="si"):
    return {"tipo": "estudio", "titulo": titulo, "nivelEducativo": nivel, "graduado": graduado}


# (1) Experiencia: sin fecha fin no suma; nada cuenta más allá de hoy.
def test_experiencia_sin_fecha_fin_ni_actual_no_suma():
    assert _total_experiencia_anios([{"fechaInicio": "2015-01-01"}]) == 0.0


def test_experiencia_con_fecha_fin_futura_cuenta_solo_hasta_hoy():
    inicio = (date.today() - timedelta(days=365)).isoformat()
    total = _total_experiencia_anios([{"fechaInicio": inicio, "fechaTerminacion": "2099-01-01"}])
    assert 0.99 < total < 1.01


def test_experiencia_que_empieza_en_el_futuro_no_suma():
    assert _total_experiencia_anios([{"fechaInicio": "2099-01-01", "actual": True}]) == 0.0


def test_experiencia_sin_fecha_fin_no_alcanza_el_minimo():
    solicitud = {**SOLICITUD_BASE, "experiencia": [{"fechaInicio": "2010-01-01"}]}
    resultado = evaluar_postulacion(solicitud, {"criterios": {"experiencia_min_anios": 2}})
    assert resultado["detalle"]["experiencia"]["cumple"] is False


# (2) Profesión de varias palabras con distinto género/número.
def test_profesion_de_varias_palabras_con_genero_distinto_cumple():
    assert _texto_incluye_keyword("Ingeniero Civil", "Ingeniería Civil")
    assert _texto_incluye_keyword("Ingeniera Industrial", "Ingeniería Industrial")
    assert _texto_incluye_keyword("Ingeniero en Sistemas", "Ingeniería de Sistemas")


def test_profesion_de_varias_palabras_exige_todas_las_palabras():
    assert not _texto_incluye_keyword("Ingeniero Industrial", "Ingeniería Civil")


def test_titulo_ingeniero_civil_cumple_vacante_de_ingenieria_civil():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [_estudio("Ingeniero Civil")]}
    resultado = evaluar_postulacion(solicitud, {"criterios": {"profesion_keyword": "Ingeniería Civil"}})
    assert resultado["cumple"] is True


# (3) Sin coincidencias por pedazos de palabra.
def test_keyword_no_coincide_con_pedazo_de_otra_palabra():
    assert not _texto_incluye_keyword("Excelencia en servicio al cliente", "Excel")
    assert not _texto_incluye_keyword("Gestión de cartera", "Arte")
    assert not _texto_incluye_keyword("JavaScript avanzado", "Java")
    assert _texto_incluye_keyword("Curso de Excel avanzado", "Excel")


def test_certificacion_excel_no_se_cumple_con_curso_de_excelencia():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [{"tipo": "educacionTrabajo", "nombreEvento": "Excelencia en servicio"}]}
    resultado = evaluar_postulacion(solicitud, {"criterios": {"certificaciones_keywords": ["Excel"]}})
    assert resultado["detalle"]["conocimientos"]["cumple"] is False


# (4) La profesión se califica en Estudios (columna del GTH-FOR-04), no en Conocimientos.
def test_profesion_que_no_coincide_marca_estudios_en_no():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [_estudio("Derecho", "Postgrado")]}
    vacante = {"criterios": {"nivel_educativo_min": "Universitario", "profesion_keyword": "Contaduría"}}
    resultado = evaluar_postulacion(solicitud, vacante)
    assert resultado["detalle"]["estudios"]["cumple"] is False
    assert resultado["detalle"]["conocimientos"]["cumple"] is None
    assert "Contaduría" in resultado["detalle"]["estudios"]["motivo"]


def test_estudios_cumple_solo_si_nivel_y_profesion_cumplen():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [_estudio("Contaduría Pública", "Universitario")]}
    vacante = {"criterios": {"nivel_educativo_min": "Universitario", "profesion_keyword": "Contaduría"}}
    assert evaluar_postulacion(solicitud, vacante)["detalle"]["estudios"]["cumple"] is True



def test_experiencia_minima_cero_es_un_requisito_que_siempre_cumple():
    resultado = evaluar_postulacion(SOLICITUD_BASE, {"criterios": {"experiencia_min_anios": 0}})
    assert resultado["detalle"]["experiencia"]["cumple"] is True


# Sobrecalificación: cumple (el nivel es un mínimo), pero queda un aviso.
def test_nivel_superior_cumple_con_aviso_de_sobrecalificado():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [_estudio("Ingeniería Civil", "Universitario")]}
    resultado = evaluar_postulacion(solicitud, {"criterios": {"nivel_educativo_min": "Tecnólogo"}})
    assert resultado["cumple"] is True
    assert resultado["detalle"]["estudios"]["cumple"] is True
    aviso = resultado["detalle"]["estudios"]["aviso"]
    assert "Sobrecalificado" in aviso and "Universitario" in aviso and "Tecnólogo" in aviso
    assert resultado["avisos"] == [aviso]


def test_nivel_exacto_no_tiene_aviso():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [_estudio("Tecnología en obras civiles", "Tecnólogo")]}
    resultado = evaluar_postulacion(solicitud, {"criterios": {"nivel_educativo_min": "Tecnólogo"}})
    assert resultado["detalle"]["estudios"]["aviso"] is None
    assert resultado["avisos"] == []


def test_estudio_superior_sin_graduar_no_cuenta_como_sobrecalificado():
    solicitud = {**SOLICITUD_BASE, "registros_ii": [
        _estudio("Tecnología en obras civiles", "Tecnólogo"),
        _estudio("Ingeniería Civil", "Universitario", graduado="no"),
    ]}
    resultado = evaluar_postulacion(solicitud, {"criterios": {"nivel_educativo_min": "Tecnólogo", "graduado_requerido": True}})
    assert resultado["detalle"]["estudios"]["aviso"] is None


def test_la_api_conserva_el_aviso_de_sobrecalificado():
    from app.schemas.solicitud import EvaluacionOut
    solicitud = {**SOLICITUD_BASE, "registros_ii": [_estudio("Ingeniería Civil", "Postgrado")]}
    evaluacion = evaluar_postulacion(solicitud, {"criterios": {"nivel_educativo_min": "Técnico"}})
    salida = EvaluacionOut.model_validate(evaluacion).model_dump()
    assert salida["detalle"]["estudios"]["aviso"].startswith("Sobrecalificado")
    assert salida["avisos"] == evaluacion["avisos"]
