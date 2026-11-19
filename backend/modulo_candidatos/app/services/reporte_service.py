# ==============================================================
# modulo_candidatos / app/services/reporte_service.py
# Genera el reporte GTH-FOR-04 (Resultados Cumplimiento de Requisitos) para
# una vacante, partiendo de la plantilla real en app/resources/ — así se
# conservan las 2 hojas, las celdas combinadas y todo el formato original,
# sin recrearlo desde cero.
#
# Reemplaza al reporte GTH-FOR-03 que se usaba antes (decisión explícita:
# GTH-FOR-04 es ahora el único reporte descargable por vacante).
# ==============================================================

import copy
import io
import os
import zipfile

import openpyxl
from openpyxl.drawing.image import Image as ImagenExcel
from openpyxl.drawing.spreadsheet_drawing import AnchorMarker, OneCellAnchor
from openpyxl.drawing.xdr import XDRPositiveSize2D
from openpyxl.utils import get_column_letter
from openpyxl.utils.units import pixels_to_EMU

from app.services import evaluacion_service

RUTA_PLANTILLA = os.path.join(os.path.dirname(__file__), "..", "resources", "GTH-FOR-04_Resultados_Cumplimiento_de_Requisitos.xlsx")

# Hoja "Aspirantes": filas 13 a 58 (46 aspirantes máximo), ya con formato listo.
FILA_INICIO_ASPIRANTES = 13
MAX_FILAS_ASPIRANTES = 46

# Hoja "Resultados_reclutamiento": filas 16 a 28 (13 aspirantes máximo; la 29 es
# una fila separadora de 8 pt antes de "INFORMACIÓN IMPORTANTE").
FILA_INICIO_RECLUTAMIENTO = 16
MAX_FILAS_RECLUTAMIENTO = 13

# Rango combinado donde va el logo en ambas hojas.
CELDAS_LOGO = ("A", "C", 1, 3)


def _describir_estudios(criterios: dict) -> str:
    nivel = criterios.get("nivel_educativo_min")
    if not nivel:
        return "Sin requisito específico configurado."
    graduado = criterios.get("graduado_requerido", True)
    texto = f"{nivel} o superior" + (" (graduado)" if graduado else "")
    kw = criterios.get("profesion_keyword")
    if kw:
        texto += f'. Profesión/título relacionado con "{kw}".'
    return texto


def _describir_experiencia(criterios: dict) -> str:
    anios = criterios.get("experiencia_min_anios")
    if anios is None or anios == "":
        return "Sin requisito específico configurado."
    if float(anios) == 0:
        return "No se exige experiencia previa."
    return f"Mínimo {anios} año(s)."


def _describir_conocimientos(criterios: dict) -> str:
    partes = []
    idioma = criterios.get("idioma_requerido")
    if idioma:
        nivel = evaluacion_service.nivel_idioma_normalizado(criterios.get("idioma_nivel_min"))
        partes.append(f"{idioma} — nivel de dominio {nivel} o superior" if nivel else f"{idioma}")
    certs = criterios.get("certificaciones_keywords") or []
    if certs:
        partes.append("Certificaciones/cursos relacionados con: " + ", ".join(certs))
    return "; ".join(partes) if partes else "Sin requisito específico configurado."


# Columnas que quedan vacías cuando la vacante no pide ese tipo de requisito.
CATEGORIAS_EN_BLANCO_SIN_CRITERIO = {"conocimientos"}


def _marcas_evaluacion(solicitud) -> dict:
    """{columna: 'X'} a partir de evaluar_postulacion().detalle.
    Cuando la vacante no tiene configurado un criterio (cumple: None):
    - Estudios y Experiencia se marcan SÍ (no hay nada que incumplir).
    - Conocimientos complementarios queda en blanco: si la vacante no pide
      idioma ni certificaciones, esa columna no aplica.
    Una postulación sin evaluación guardada queda toda en blanco."""
    evaluacion = getattr(solicitud, "evaluacion", None) or {}
    if "detalle" not in evaluacion:
        return {}
    detalle = evaluacion.get("detalle") or {}
    mapa = {"estudios": ("C", "D"), "conocimientos": ("E", "F"), "experiencia": ("G", "H")}
    marcas = {}
    for categoria, (col_si, col_no) in mapa.items():
        cumple = (detalle.get(categoria) or {}).get("cumple")
        if cumple is None and categoria in CATEGORIAS_EN_BLANCO_SIN_CRITERIO:
            continue
        marcas[col_no if cumple is False else col_si] = "X"
    return marcas


def _observaciones(solicitud) -> str | None:
    """Avisos informativos de la evaluación (p. ej. sobrecalificado) para la
    columna OBSERVACIONES; Gestión Humana puede completarla a mano."""
    avisos = (getattr(solicitud, "evaluacion", None) or {}).get("avisos") or []
    return " ".join(avisos) or None


def _logo_de_la_plantilla() -> bytes | None:
    """En la plantilla el logo está "colocado en la celda" A1 (imagen dentro de la
    celda de Excel). openpyxl no conserva ese tipo de imagen: al guardar, A1 queda
    como #VALUE! y el logo desaparece. Se toma el PNG del propio archivo para
    volver a ponerlo como imagen flotante sobre A1:C3."""
    try:
        with zipfile.ZipFile(RUTA_PLANTILLA) as z:
            medios = sorted(n for n in z.namelist() if n.startswith("xl/media/"))
            return z.read(medios[0]) if medios else None
    except (OSError, zipfile.BadZipFile):
        return None


def _ancho_px(ws, letra: str) -> float:
    ancho = ws.column_dimensions[letra].width if letra in ws.column_dimensions else None
    return (ancho or 8.43) * 7 + 5  # caracteres -> píxeles (fuente Calibri 11)


def _alto_px(ws, fila: int) -> float:
    return (ws.row_dimensions[fila].height or 15) * 96 / 72  # puntos -> píxeles


def _poner_logo(ws, png: bytes):
    """Logo centrado dentro de A1:C3, con margen, sin deformarlo."""
    col_ini, col_fin, fila_ini, fila_fin = CELDAS_LOGO
    cols = [get_column_letter(i) for i in range(openpyxl.utils.column_index_from_string(col_ini),
                                                 openpyxl.utils.column_index_from_string(col_fin) + 1)]
    anchos = [_ancho_px(ws, c) for c in cols]
    altos = [_alto_px(ws, f) for f in range(fila_ini, fila_fin + 1)]

    imagen = ImagenExcel(io.BytesIO(png))
    escala = min((sum(anchos) - 24) / imagen.width, (sum(altos) - 16) / imagen.height, 1.0)
    ancho, alto = imagen.width * escala, imagen.height * escala
    x, y = (sum(anchos) - ancho) / 2, (sum(altos) - alto) / 2

    # El ancla es la celda donde empieza la imagen + desplazamiento dentro de ella.
    col_idx = 0
    while col_idx < len(anchos) - 1 and x >= anchos[col_idx]:
        x -= anchos[col_idx]
        col_idx += 1
    fila_idx = 0
    while fila_idx < len(altos) - 1 and y >= altos[fila_idx]:
        y -= altos[fila_idx]
        fila_idx += 1

    marcador = AnchorMarker(
        col=openpyxl.utils.column_index_from_string(cols[col_idx]) - 1, colOff=pixels_to_EMU(x),
        row=fila_ini - 1 + fila_idx, rowOff=pixels_to_EMU(y),
    )
    imagen.anchor = OneCellAnchor(_from=marcador, ext=XDRPositiveSize2D(pixels_to_EMU(ancho), pixels_to_EMU(alto)))
    ws["A1"] = None  # quita el #VALUE! que deja la imagen-en-celda que openpyxl no entiende
    ws.add_image(imagen)


def _corregir_plantilla_aspirantes(ws):
    """Dos detalles de la plantilla actual que afectarían el reporte:
    - TOTAL (I59/J59) cuenta desde la fila 14, pero el primer aspirante va en la 13.
    - B13 perdió su formato (sin bordes) respecto al resto de la columna."""
    fin = FILA_INICIO_ASPIRANTES + MAX_FILAS_ASPIRANTES - 1
    for col in ("I", "J"):
        ws[f"{col}{fin + 1}"] = f'=COUNTIF({col}{FILA_INICIO_ASPIRANTES}:{col}{fin},"X")'
    modelo = ws[f"B{FILA_INICIO_ASPIRANTES + 1}"]
    celda = ws[f"B{FILA_INICIO_ASPIRANTES}"]
    celda.border = copy.copy(modelo.border)
    celda.fill = copy.copy(modelo.fill)
    celda.font = copy.copy(modelo.font)
    celda.alignment = copy.copy(modelo.alignment)
    celda.number_format = modelo.number_format


def _escribir_fila(ws, fila_num: int, datos: dict):
    for col_letra, valor in datos.items():
        if valor in (None, ""):
            continue
        ws[f"{col_letra}{fila_num}"] = valor


def generar_reporte_vacante(vacante_info: dict, solicitudes: list) -> bytes:
    """
    vacante_info: dict con proceso_no, cargo, salario, fecha_apertura, fecha_cierre, criterios.
    solicitudes: lista de objetos Solicitud (modelo SQLAlchemy).
    Devuelve los bytes del .xlsx (GTH-FOR-04) listo para descargar.
    """
    wb = openpyxl.load_workbook(RUTA_PLANTILLA)
    criterios = vacante_info.get("criterios") or {}
    cargo = vacante_info.get("cargo") or "—"
    proceso_no = vacante_info.get("proceso_no") or "—"
    fecha_apertura = vacante_info.get("fecha_apertura") or "—"
    fecha_cierre = vacante_info.get("fecha_cierre") or "—"
    salario = vacante_info.get("salario") or "—"
    desc_estudios = _describir_estudios(criterios)
    desc_experiencia = _describir_experiencia(criterios)
    desc_conocimientos = _describir_conocimientos(criterios)

    ws1 = wb["Aspirantes"]
    ws2 = wb["Resultados_reclutamiento"]
    logo = _logo_de_la_plantilla()
    for ws in (ws1, ws2):
        if logo:
            _poner_logo(ws, logo)
        else:
            ws["A1"] = None
    _corregir_plantilla_aspirantes(ws1)

    ws1["D4"] = cargo
    ws1["D5"] = proceso_no
    ws1["D6"] = fecha_apertura
    ws1["D7"] = fecha_cierre
    ws1["D8"] = desc_estudios
    ws1["D9"] = desc_experiencia
    ws1["D10"] = desc_conocimientos

    for i, solicitud in enumerate(solicitudes[:MAX_FILAS_ASPIRANTES]):
        fila_num = FILA_INICIO_ASPIRANTES + i
        dp = solicitud.datos_personales or {}
        fila = {"A": dp.get("cedula"), "B": dp.get("nombreCompleto"), "K": _observaciones(solicitud),
                "L": dp.get("correo"), "M": dp.get("celular")}
        fila.update(_marcas_evaluacion(solicitud))
        _escribir_fila(ws1, fila_num, fila)

    # En esta versión de la plantilla la fila 5 es una sola celda combinada A5:L5.
    ws2["A5"] = f"PROCESO DE SELECCIÓN Nº: {proceso_no}"
    ws2["A6"] = f"CARGO: {cargo}"
    ws2["A7"] = f"SALARIO BASICO: {salario}"
    ws2["A8"] = f"FECHA APERTURA: {fecha_apertura}"
    ws2["A9"] = f"FECHA CIERRE: {fecha_cierre}"
    ws2["A10"] = f"ESTUDIOS: {desc_estudios}"
    ws2["A11"] = f"EXPERIENCIA: {desc_experiencia}"

    for i, solicitud in enumerate(solicitudes[:MAX_FILAS_RECLUTAMIENTO]):
        fila_num = FILA_INICIO_RECLUTAMIENTO + i
        dp = solicitud.datos_personales or {}
        fila = {"A": dp.get("cedula"), "B": dp.get("nombreCompleto"), "K": _observaciones(solicitud)}
        fila.update(_marcas_evaluacion(solicitud))
        _escribir_fila(ws2, fila_num, fila)

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
