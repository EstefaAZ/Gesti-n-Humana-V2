# ==============================================================
# modulo_candidatos / app/services/reporte_service.py
# Genera el reporte GTH-FOR-03 (Base de Aspirantes) para una vacante,
# partiendo de la plantilla real en app/resources/ — así se conservan
# fórmulas, validaciones de listas desplegables y todo el formato
# original, sin tener que recrearlo desde cero.
#
# LÍMITE CONOCIDO: nuestro formulario de inscripción no captura por
# separado Apellidos/Nombres (solo el nombre completo junto), Género,
# Teléfono de oficina, "N° de años aprobados" cuando no se graduó, ni
# "Principales funciones" de cada experiencia (eso solo queda dentro del
# PDF de certificado laboral adjunto, no como texto). Esas columnas del
# reporte quedan en blanco a propósito — no es un error, es que el dato
# nunca se le pidió al candidato.
# ==============================================================

import io
import os
from copy import copy
from datetime import date

import openpyxl

RUTA_PLANTILLA = os.path.join(os.path.dirname(__file__), "..", "resources", "GTH-FOR-03_Base_Aspirantes.xlsx")

MAX_FILAS_ASPIRANTES = 62  # filas 7 a 68, ya vienen con fórmulas/validaciones en la plantilla
MAX_FILAS_TRASPASO = 61    # filas 7 a 67 (la 68 es la fila de "TOTAL")

ORDEN_NIVEL_EDUCATIVO = [
    "Secundarios", "Técnico", "Tecnólogo", "Universitario",
    "Postgrado", "Postgrado - Especialización", "Postgrado - Maestría", "Postgrado - Doctorado", "Otro",
]


def _si_no(valor) -> str:
    if valor == "si":
        return "SI"
    if valor == "no":
        return "NO"
    return ""


def _fecha(valor):
    """Convierte 'YYYY-MM-DD' o 'YYYY-MM' (string) a date real, para que Excel la trate como fecha de verdad."""
    if not valor:
        return None
    try:
        partes = str(valor).split("-")
        if len(partes) == 3:
            return date(int(partes[0]), int(partes[1]), int(partes[2]))
        if len(partes) == 2:
            return date(int(partes[0]), int(partes[1]), 1)
    except (ValueError, TypeError):
        return None
    return None


def _mejor_estudio(registros_ii: list) -> dict | None:
    """El registro tipo=estudio de nivel más alto (para "Nivel educativo más alto")."""
    estudios = [r for r in registros_ii if r.get("tipo") == "estudio"]
    if not estudios:
        return None

    def _rango(r):
        nivel = r.get("nivelEducativo") or ""
        try:
            return ORDEN_NIVEL_EDUCATIVO.index(nivel)
        except ValueError:
            return -1

    return max(estudios, key=_rango)


def _fila_aspirante(solicitud, vacante_info: dict) -> dict:
    """Arma {columna: valor} para UNA fila de la hoja 'Aspirantes', a partir de una Solicitud."""
    dp = solicitud.datos_personales or {}
    registros = solicitud.registros_ii or []
    experiencias = solicitud.experiencia or []
    conflicto = solicitud.conflicto or {}
    familiares = conflicto.get("familiares") or []

    fila = {
        "A": dp.get("cedula"),
        "C": dp.get("nombreCompleto"),  # "B" (Apellidos) queda vacío — ver nota del módulo
        "F": _fecha(dp.get("fechaNacimiento")),
        "G": dp.get("ciudadNacimiento"),
        "H": dp.get("deptoNacimiento"),
        "I": dp.get("paisNacimiento"),
        "J": dp.get("estadoCivil"),
        "K": dp.get("numHijos"),
        "L": _si_no(dp.get("licencia")),
        "M": dp.get("licenciaClase"),
        "N": _si_no(dp.get("tieneVehiculo")),
        "O": dp.get("tarjetaProfesional"),
        "P": dp.get("profesion"),
        "Q": dp.get("direccion"),
        "R": dp.get("municipio"),
        "S": dp.get("deptoResidencia"),
        "T": dp.get("telResidencia"),
        "V": dp.get("celular"),
        "W": dp.get("correo"),
        "BQ": vacante_info.get("proceso_no"),
        "BR": _fecha(str(solicitud.fecha_solicitud.date())) if solicitud.fecha_solicitud else None,
    }

    estudio = _mejor_estudio(registros)
    if estudio:
        fila.update({
            "X": estudio.get("nivelEducativo"),
            "Y": estudio.get("titulo"),
            "Z": estudio.get("establecimiento"),
            "AA": estudio.get("ciudad"),
            "AB": _si_no(estudio.get("graduado")),
            "AC": _fecha(estudio.get("terminacion")),
        })

    cursos_o_certs = [r for r in registros if r.get("tipo") in ("educacionTrabajo", "certificacion")][:2]
    columnas_curso = [("AE", "AF", "AG"), ("AH", "AI", "AJ")]
    for (col_nombre, col_horas, col_institucion), reg in zip(columnas_curso, cursos_o_certs):
        if reg.get("tipo") == "educacionTrabajo":
            fila[col_nombre] = reg.get("nombreEvento")
            fila[col_horas] = reg.get("numHoras")
            fila[col_institucion] = reg.get("establecimiento")
        else:  # certificacion
            fila[col_nombre] = reg.get("nombreNorma")
            fila[col_institucion] = reg.get("enteCertificador")

    idiomas = [r for r in registros if r.get("tipo") == "idioma"]
    if idiomas:
        idioma = idiomas[0]
        fila.update({"AK": idioma.get("idioma"), "AL": idioma.get("habla"), "AM": idioma.get("lee"), "AN": idioma.get("escribe")})

    columnas_experiencia = [
        ("AO", "AP", "AQ", "AR", "AS", "AU"),
        ("AW", "AX", "AY", "AZ", "BA", "BC"),
        ("BE", "BF", "BG", "BH", "BI", "BK"),
    ]
    for (c_empresa, c_cargo, c_tipo, c_inicio, c_fin, c_dedicacion), exp in zip(columnas_experiencia, experiencias[:3]):
        fecha_fin = exp.get("fechaTerminacion")
        if exp.get("actual") and not fecha_fin:
            fecha_fin = date.today().isoformat()  # para que la fórmula de "tiempo laborado" calcule algo real
        fila.update({
            c_empresa: exp.get("empresa"),
            c_cargo: exp.get("cargo"),
            c_tipo: exp.get("tipoEmpresa"),
            c_inicio: _fecha(exp.get("fechaInicio")),
            c_fin: _fecha(fecha_fin),
            c_dedicacion: exp.get("dedicacion"),
        })

    fila["BM"] = _si_no(conflicto.get("tieneVinculo"))
    if familiares:
        f = familiares[0]
        fila.update({"BN": f.get("parentesco"), "BO": f.get("nombreEmpleado"), "BP": f.get("cargo")})

    return fila


def _fila_traspaso(solicitud) -> dict:
    """
    Arma {columna: 'X'} para la hoja 'Traspaso_a_FOR-04', a partir de la
    evaluación automática ya calculada (evaluar_postulacion). Solo se marca
    una categoría cuando la vacante SÍ tenía ese criterio configurado — si
    no, se deja en blanco para que Gestión Humana la revise a mano, tal
    como diseñó la plantilla original. La columna "Decisión" (Admitido/
    Rechazado) NUNCA se marca automáticamente — es una decisión humana.
    """
    detalle = ((getattr(solicitud, "evaluacion", None) or {}).get("detalle")) or {}
    fila = {}
    mapa = {"estudios": ("C", "D"), "conocimientos": ("E", "F"), "experiencia": ("G", "H")}
    for categoria, (col_si, col_no) in mapa.items():
        cumple = (detalle.get(categoria) or {}).get("cumple")
        if cumple is True:
            fila[col_si] = "X"
        elif cumple is False:
            fila[col_no] = "X"
    return fila


def _escribir_fila(ws, fila_num: int, datos: dict):
    for col_letra, valor in datos.items():
        if valor in (None, ""):
            continue
        ws[f"{col_letra}{fila_num}"] = valor


def generar_reporte_vacante(vacante_info: dict, solicitudes: list) -> bytes:
    """
    vacante_info: {"proceso_no": str, "cargo": str}
    solicitudes: lista de objetos Solicitud (modelo SQLAlchemy), en el orden que se quiera mostrar.
    Devuelve los bytes del .xlsx listo para descargar.
    """
    wb = openpyxl.load_workbook(RUTA_PLANTILLA)
    ws = wb["Aspirantes"]

    proceso_no = vacante_info.get("proceso_no") or "—"
    cargo = vacante_info.get("cargo") or "—"
    ws["A3"] = (
        f"Proceso de Selección No.: {proceso_no}   |   Cargo: {cargo}   |   "
        "Esta base reemplaza el diligenciamiento manual del formato GTH-FOR-03. "
        "Cada fila corresponde a UN aspirante. No modifique encabezados ni el orden de las columnas."
    )

    # La fila 7 de la plantilla trae datos de EJEMPLO fijos (no fórmulas) —
    # hay que borrarlos de verdad antes de escribir el primer aspirante real,
    # si no, se mezclan con los datos nuevos (ej. el apellido de ejemplo queda
    # pegado al nombre real). Las fórmulas (D7, AT7, BB7, BJ7) si se conservan.
    estilo_normal = ws["A8"]._style
    for col in range(1, 75):
        celda = ws.cell(row=7, column=col)
        es_formula = isinstance(celda.value, str) and celda.value.startswith("=")
        if not es_formula:
            celda.value = None
        celda._style = copy(estilo_normal)

    solicitudes_a_mostrar = solicitudes[:MAX_FILAS_ASPIRANTES]
    for i, solicitud in enumerate(solicitudes_a_mostrar):
        fila_num = 7 + i
        _escribir_fila(ws, fila_num, _fila_aspirante(solicitud, vacante_info))

    ws_traspaso = wb["Traspaso_a_FOR-04"]
    for i, solicitud in enumerate(solicitudes_a_mostrar[:MAX_FILAS_TRASPASO]):
        fila_num = 7 + i
        _escribir_fila(ws_traspaso, fila_num, _fila_traspaso(solicitud))

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
