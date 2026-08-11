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

import io
import os

import openpyxl

RUTA_PLANTILLA = os.path.join(os.path.dirname(__file__), "..", "resources", "GTH-FOR-04_Resultados_Cumplimiento_de_Requisitos.xlsx")

# Hoja "Aspirantes": filas 13 a 58 (46 aspirantes máximo), ya con formato listo.
FILA_INICIO_ASPIRANTES = 13
MAX_FILAS_ASPIRANTES = 46

# Hoja "Resultados_reclutamiento": filas 16 a 29 (14 aspirantes máximo).
FILA_INICIO_RECLUTAMIENTO = 16
MAX_FILAS_RECLUTAMIENTO = 14


def _describir_estudios(criterios: dict) -> str:
    nivel = criterios.get("nivel_educativo_min")
    if not nivel:
        return "Sin requisito específico configurado."
    graduado = criterios.get("graduado_requerido", True)
    texto = f"{nivel}" + (" (graduado)" if graduado else "")
    kw = criterios.get("profesion_keyword")
    if kw:
        texto += f'. Profesión/título relacionado con "{kw}".'
    return texto


def _describir_experiencia(criterios: dict) -> str:
    anios = criterios.get("experiencia_min_anios")
    if not anios:
        return "Sin requisito específico configurado."
    return f"Mínimo {anios} año(s)."


def _describir_conocimientos(criterios: dict) -> str:
    partes = []
    idioma = criterios.get("idioma_requerido")
    if idioma:
        partes.append(f'{idioma} — nivel mínimo {criterios.get("idioma_nivel_min", "")} ({criterios.get("idioma_habilidad", "habla")})')
    certs = criterios.get("certificaciones_keywords") or []
    if certs:
        partes.append("Certificaciones/cursos relacionados con: " + ", ".join(certs))
    return "; ".join(partes) if partes else "Sin requisito específico configurado."


def _marcas_evaluacion(solicitud) -> dict:
    """{columna: 'X'} a partir de evaluar_postulacion().detalle — solo se marca
    cuando la vacante SÍ tenía ese criterio configurado."""
    detalle = ((getattr(solicitud, "evaluacion", None) or {}).get("detalle")) or {}
    mapa = {"estudios": ("C", "D"), "conocimientos": ("E", "F"), "experiencia": ("G", "H")}
    marcas = {}
    for categoria, (col_si, col_no) in mapa.items():
        cumple = (detalle.get(categoria) or {}).get("cumple")
        if cumple is True:
            marcas[col_si] = "X"
        elif cumple is False:
            marcas[col_no] = "X"
    return marcas


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
    # A1 en la plantilla original trae una fórmula rota (#VALUE!) — no es algo
    # que este generador introduce, ya venía así en el archivo fuente. Se limpia
    # para que el reporte no salga con ese error de fórmula.
    ws1["A1"] = None
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
        fila = {"A": dp.get("cedula"), "B": dp.get("nombreCompleto"), "L": dp.get("correo"), "M": dp.get("celular")}
        fila.update(_marcas_evaluacion(solicitud))
        _escribir_fila(ws1, fila_num, fila)

    ws2 = wb["Resultados_reclutamiento"]
    ws2["D5"] = f"PROCESO DE SELECCIÓN Nº: {proceso_no}"
    ws2["A6"] = f"CARGO: {cargo}"
    ws2["A7"] = f"SALARIO BASICO: {salario}"
    ws2["A8"] = f"FECHA APERTURA: {fecha_apertura}"
    ws2["A9"] = f"FECHA CIERRE: {fecha_cierre}"
    ws2["A10"] = f"ESTUDIOS: {desc_estudios}"
    ws2["A11"] = f"EXPERIENCIA: {desc_experiencia}"

    for i, solicitud in enumerate(solicitudes[:MAX_FILAS_RECLUTAMIENTO]):
        fila_num = FILA_INICIO_RECLUTAMIENTO + i
        dp = solicitud.datos_personales or {}
        fila = {"A": dp.get("cedula"), "B": dp.get("nombreCompleto")}
        fila.update(_marcas_evaluacion(solicitud))
        _escribir_fila(ws2, fila_num, fila)

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
