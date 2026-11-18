# ==============================================================
# modulo_candidatos / tests/test_pdf_service.py
# ==============================================================

import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.pdf_service import _a_hora_colombia, generar_pdf_solicitud


def test_hora_sin_zona_se_toma_como_utc_y_pasa_a_colombia():
    # SQLite devuelve la fecha en UTC sin zona horaria: 19:37 UTC = 14:37 en Colombia.
    assert _a_hora_colombia(datetime(2026, 11, 18, 19, 37)).strftime("%d/%m/%Y %H:%M") == "18/11/2026 14:37"


def test_hora_con_zona_utc_pasa_a_colombia():
    utc = datetime(2026, 11, 18, 19, 37, tzinfo=timezone.utc)
    assert _a_hora_colombia(utc).strftime("%H:%M") == "14:37"


def test_hora_que_ya_viene_en_colombia_no_se_mueve():
    col = datetime(2026, 11, 18, 14, 37, tzinfo=timezone(timedelta(hours=-5)))
    assert _a_hora_colombia(col).strftime("%H:%M") == "14:37"


def test_solicitud_en_la_noche_conserva_el_dia_en_colombia():
    # 9:30 p. m. del 18 en Colombia = 02:30 UTC del 19: debe seguir diciendo el 18.
    assert _a_hora_colombia("2026-11-19T02:30:00").strftime("%d/%m/%Y %H:%M") == "18/11/2026 21:30"


def test_texto_iso_con_z_y_valores_invalidos():
    assert _a_hora_colombia("2026-11-18T19:37:00Z").strftime("%H:%M") == "14:37"
    assert _a_hora_colombia(None) is None
    assert _a_hora_colombia("no es fecha") is None


def test_pdf_se_genera_con_fecha_sin_zona_horaria():
    contenido = generar_pdf_solicitud({"radicado": "SOL-1", "fecha_solicitud": datetime(2026, 11, 19, 2, 30)})
    assert contenido[:4] == b"%PDF"
