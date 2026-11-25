# ==============================================================
# modulo_candidatos / app/services/pdf_service.py
# Genera el PDF de la solicitud (formato GTH-FOR-03): encabezado
# oficial de 3 columnas, ficha del candidato, franjas verdes por
# sección, campos en recuadro que crecen con el texto, registros que
# no se parten entre páginas y pie con radicado y "Página X de Y".
# ==============================================================

import os
import re
from datetime import datetime, timedelta, timezone
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from app.services import evaluacion_service

RUTA_LOGO = os.path.join(os.path.dirname(__file__), "..", "resources", "logo-aguas-nacionales.png")

MARGIN_X = 15 * mm
RIGHT_X = 195 * mm
USABLE_W = RIGHT_X - MARGIN_X
PAGE_W, PAGE_H = A4
LIMITE_INFERIOR = 18 * mm  # el contenido no baja de aquí (debajo va el pie de página)
PIE_Y = 9 * mm

GREEN_900 = (0 / 255, 77 / 255, 32 / 255)
GREEN_800 = (0 / 255, 98 / 255, 40 / 255)
GREEN_500 = (46 / 255, 160 / 255, 74 / 255)
GREEN_200 = (190 / 255, 222 / 255, 198 / 255)
GREEN_50 = (240 / 255, 248 / 255, 242 / 255)
TEXT = (27 / 255, 43 / 255, 34 / 255)
TEXT_MUTED = (91 / 255, 107 / 255, 96 / 255)
BORDER = (30 / 255, 30 / 255, 30 / 255)  # solo el encabezado oficial
BOX_BORDER = (190 / 255, 199 / 255, 193 / 255)
BOX_FILL = (250 / 255, 251 / 255, 250 / 255)

HEADER_TOP_FROM_TOP = 10 * mm
HEADER_H = 20 * mm
COL_LOGO_W = 40 * mm
COL_CODE_W = 45 * mm
COL_TITLE_W = USABLE_W - COL_LOGO_W - COL_CODE_W
INICIO_CONTENIDO = PAGE_H - HEADER_TOP_FROM_TOP - HEADER_H - 7 * mm

LABEL_SIZE = 6.8
LABEL_LEADING = 3.1 * mm
LABEL_GAP = 0.9 * mm       # etiqueta -> su recuadro (más cerca que del recuadro de arriba)
VALUE_SIZE = 9.5
VALUE_LEADING = 4.1 * mm
CAP_H = 0.72 * VALUE_SIZE  # alto de mayúsculas, para centrar el texto en el recuadro
BOX_PAD_X = 2 * mm
BOX_PAD_Y = 1 * mm
MAX_LINEAS_VALOR = 4
COL_GAP = 4 * mm
ROW_GAP = 3.4 * mm
SECTION_H = 14 * mm        # franja de sección + aire
SUBTITLE_H = 7.5 * mm
ESPACIO_MIN_PARA_PARTIR = 45 * mm  # con menos espacio libre, un registro pasa entero a la página siguiente

# Etiqueta legible por tipo de Registro II — espejo de TIPO_REGISTRO_LABELS en
# frontend/src/data/catalogos.js. Se resuelve por `tipo` (no por `tipoLabel`,
# que el cliente puede omitir) para que el PDF quede legible sin importar el
# origen de los datos (wizard, script de datos de prueba, registros antiguos).
TIPO_REGISTRO_LABELS = {
    "estudio": "Estudio formal",
    "educacionTrabajo": "Educación para el trabajo y el desarrollo humano",
    "certificacion": "Certificaciones y matrículas",
    "idioma": "Idioma",
}


def _categorias_licencia(dp: dict) -> list[str]:
    """Categorías de la licencia (una licencia puede tener varias). Antes se
    guardaba una sola clase en `licenciaClase`; se sigue leyendo."""
    if isinstance(dp.get("licenciaClases"), list):
        return [str(c) for c in dp["licenciaClases"] if c]
    anterior = str(dp.get("licenciaClase") or "").strip()
    return [c.strip() for c in re.split(r"[,;]", anterior) if c.strip()] if anterior else []


def _sino(v) -> str:
    return "Sí" if v in (True, "si", "Si", "sí") else "No"


_RE_FECHA = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?")


def _fecha(v, con_hora=False):
    """'2026-11-18' -> '18/11/2026' (y la hora si se pide). Si no es una fecha ISO, se deja igual."""
    if v in (None, ""):
        return v
    m = _RE_FECHA.match(str(v))
    if not m:
        return v
    anio, mes, dia, hora, minuto = m.groups()
    texto = f"{dia}/{mes}/{anio}"
    if con_hora and hora:
        texto += f" {hora}:{minuto}"
    return texto


# Colombia está en UTC-5 todo el año (sin horario de verano). Desfase fijo para
# no depender de la base de zonas horarias (tzdata), que no siempre está en Windows.
HORA_COLOMBIA = timezone(timedelta(hours=-5))


def _a_hora_colombia(v):
    """La base guarda fecha_solicitud en UTC (SQLite la devuelve sin zona horaria).
    Devuelve el datetime en hora de Colombia, o None si no se puede interpretar."""
    if not v:
        return None
    if not isinstance(v, datetime):
        try:
            v = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        except ValueError:
            return None
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v.astimezone(HORA_COLOMBIA)


def _envolver(texto, fuente, tam, ancho, max_lineas=None):
    """Parte el texto en líneas que caben en `ancho`. Las palabras que no caben
    solas (correos, URLs) se cortan por caracteres en vez de salirse del recuadro."""
    lineas = []
    for parrafo in str(texto).split("\n"):
        actual = ""
        for palabra in parrafo.split(" "):
            prueba = f"{actual} {palabra}".strip()
            if stringWidth(prueba, fuente, tam) <= ancho:
                actual = prueba
                continue
            if actual:
                lineas.append(actual)
            while stringWidth(palabra, fuente, tam) > ancho:
                corte = len(palabra)
                while corte > 1 and stringWidth(palabra[:corte], fuente, tam) > ancho:
                    corte -= 1
                lineas.append(palabra[:corte])
                palabra = palabra[corte:]
            actual = palabra
        lineas.append(actual)
    if max_lineas and len(lineas) > max_lineas:
        lineas = lineas[:max_lineas]
        ultima = lineas[-1]
        while ultima and stringWidth(ultima + "…", fuente, tam) > ancho:
            ultima = ultima[:-1]
        lineas[-1] = ultima + "…"
    return lineas or [""]


def _valor(v) -> str:
    return str(v if v not in (None, "") else "—").strip() or "—"


class _CanvasNumerado(canvas.Canvas):
    """Guarda cada página hasta el final para poder escribir "Página X de Y" en el pie."""

    def __init__(self, *args, texto_pie="", **kwargs):
        super().__init__(*args, **kwargs)
        self._paginas = []
        self.texto_pie = texto_pie

    def showPage(self):
        self._paginas.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._paginas)
        for estado in self._paginas:
            self.__dict__.update(estado)
            self._dibujar_pie(total)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def _dibujar_pie(self, total):
        self.setStrokeColorRGB(*BOX_BORDER)
        self.setLineWidth(0.25 * mm)
        self.line(MARGIN_X, PIE_Y + 3.5 * mm, RIGHT_X, PIE_Y + 3.5 * mm)
        self.setFont("Helvetica", 7.5)
        self.setFillColorRGB(*TEXT_MUTED)
        izquierda = _envolver(self.texto_pie, "Helvetica", 7.5, USABLE_W - 30 * mm, 1)[0]
        self.drawString(MARGIN_X, PIE_Y, izquierda)
        self.drawRightString(RIGHT_X, PIE_Y, f"Página {self._pageNumber} de {total}")


class PdfBuilder:
    def __init__(self, texto_pie=""):
        self.buffer = BytesIO()
        self.c = _CanvasNumerado(self.buffer, pagesize=A4, texto_pie=texto_pie)
        self.y = INICIO_CONTENIDO  # reportlab: origen (0,0) abajo-izquierda
        self._titulo_pendiente = None
        self._draw_header()

    def _y_from_top(self, mm_from_top):
        return PAGE_H - mm_from_top

    @staticmethod
    def _cabe_en_pagina_nueva(h):
        return h <= INICIO_CONTENIDO - LIMITE_INFERIOR

    def _nueva_pagina(self):
        self.c.showPage()
        self._draw_header()

    def ensure_space(self, next_h):
        if self.y - next_h < LIMITE_INFERIOR:
            self._nueva_pagina()

    def _reservar(self, h):
        """Antes de dibujar un bloque: si hay un título de sección pendiente, viaja
        con él (nunca queda un título solo al final de una página)."""
        extra = SECTION_H if self._titulo_pendiente else 0
        self.ensure_space(extra + h)
        if self._titulo_pendiente:
            numeral, texto = self._titulo_pendiente
            self._titulo_pendiente = None
            self._dibujar_titulo_seccion(numeral, texto)

    def _draw_header(self):
        c = self.c
        top_y = self._y_from_top(HEADER_TOP_FROM_TOP)
        bottom_y = top_y - HEADER_H
        x1, x2, x3 = MARGIN_X, MARGIN_X + COL_LOGO_W, MARGIN_X + COL_LOGO_W + COL_TITLE_W

        c.setLineWidth(0.3 * mm)
        c.setStrokeColorRGB(*BORDER)
        c.rect(x1, bottom_y, USABLE_W, HEADER_H, fill=0, stroke=1)
        c.line(x2, bottom_y, x2, top_y)
        c.line(x3, bottom_y, x3, top_y)

        # Celda logo — imagen real del logo, centrada y con su proporción
        logo_cx = x1 + COL_LOGO_W / 2
        logo_cy = (top_y + bottom_y) / 2
        try:
            logo = ImageReader(RUTA_LOGO)
            iw, ih = logo.getSize()
            draw_w = 28 * mm
            draw_h = draw_w * ih / iw
            if draw_h > HEADER_H - 4 * mm:
                draw_h = HEADER_H - 4 * mm
                draw_w = draw_h * iw / ih
            c.drawImage(
                logo, logo_cx - draw_w / 2, logo_cy - draw_h / 2, width=draw_w, height=draw_h,
                mask="auto", preserveAspectRatio=True,
            )
        except Exception:
            # Si por algún motivo el logo no está disponible, no se cae el PDF — se deja la celda en blanco.
            pass

        # Celda título — cortado por frases, no donde se acabe el ancho.
        c.setFont("Helvetica-BoldOblique", 11.5)
        c.setFillColorRGB(*TEXT)
        titulo_cx = x2 + COL_TITLE_W / 2
        c.drawCentredString(titulo_cx, top_y - 8.6 * mm, "Solicitud de Inscripción")
        c.drawCentredString(titulo_cx, top_y - 14.4 * mm, "a Proceso de Selección")

        # Celda código
        c.setFont("Helvetica-BoldOblique", 8)
        codigo_cx = x3 + COL_CODE_W / 2
        c.drawCentredString(codigo_cx, top_y - 7 * mm, "Código: GTH-FOR-03")
        c.drawCentredString(codigo_cx, top_y - 12 * mm, "Versión: 02")
        c.drawCentredString(codigo_cx, top_y - 17 * mm, "Fecha: 03/08/2023")

        self.y = INICIO_CONTENIDO

    def ficha_resumen(self, nombre, detalle, radicado, fecha):
        """Franja de identificación al inicio: quién es el candidato y qué radicado tiene."""
        c = self.c
        h = 15 * mm
        top = self.y
        c.setFillColorRGB(*GREEN_50)
        c.setStrokeColorRGB(*GREEN_200)
        c.setLineWidth(0.3 * mm)
        c.roundRect(MARGIN_X, top - h, USABLE_W, h, 1.6 * mm, fill=1, stroke=1)
        c.setFillColorRGB(*GREEN_800)
        c.rect(MARGIN_X, top - h, 1.4 * mm, h, fill=1, stroke=0)

        ancho_izq = USABLE_W - 62 * mm
        c.setFont("Helvetica-Bold", 12.5)
        c.setFillColorRGB(*TEXT)
        c.drawString(MARGIN_X + 5 * mm, top - 6.4 * mm, _envolver(nombre, "Helvetica-Bold", 12.5, ancho_izq, 1)[0])
        c.setFont("Helvetica", 8.5)
        c.setFillColorRGB(*TEXT_MUTED)
        c.drawString(MARGIN_X + 5 * mm, top - 11.4 * mm, _envolver(detalle, "Helvetica", 8.5, ancho_izq, 1)[0])

        c.setFont("Helvetica", 7)
        c.drawRightString(RIGHT_X - 4 * mm, top - 5 * mm, "RADICADO")
        c.setFont("Helvetica-Bold", 11)
        c.setFillColorRGB(*GREEN_900)
        c.drawRightString(RIGHT_X - 4 * mm, top - 9.4 * mm, radicado)
        c.setFont("Helvetica", 7.5)
        c.setFillColorRGB(*TEXT_MUTED)
        c.drawRightString(RIGHT_X - 4 * mm, top - 12.8 * mm, f"Solicitud: {fecha}")
        self.y = top - h - 6 * mm

    def section_title(self, numeral, texto):
        # Se dibuja junto con el primer bloque de contenido (ver _reservar).
        self._titulo_pendiente = (numeral, texto)

    def _dibujar_titulo_seccion(self, numeral, texto):
        c = self.c
        if self.y < INICIO_CONTENIDO - 0.1:
            self.y -= 2 * mm  # aire extra respecto a la sección anterior (no al inicio de página)
        bar_h = 7.5 * mm
        c.setFillColorRGB(*GREEN_800)
        c.rect(MARGIN_X, self.y - bar_h, USABLE_W, bar_h, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColorRGB(1, 1, 1)
        c.drawString(MARGIN_X + 3 * mm, self.y - bar_h + 2.4 * mm, f"{numeral}.  {texto}")
        self.y -= bar_h + 4.5 * mm

    # ---- Campos ----
    def _medir_fila(self, campos):
        n = len(campos)
        col_w = (USABLE_W - COL_GAP * (n - 1)) / n
        etiquetas = [_envolver(lbl.upper(), "Helvetica-Bold", LABEL_SIZE, col_w) for lbl, _ in campos]
        valores = [
            _envolver(_valor(v), "Helvetica", VALUE_SIZE, col_w - 2 * BOX_PAD_X, MAX_LINEAS_VALOR) for _, v in campos
        ]
        n_etq = max(len(e) for e in etiquetas)
        n_val = max(len(v) for v in valores)
        box_h = n_val * VALUE_LEADING + 2 * BOX_PAD_Y
        alto = n_etq * LABEL_LEADING + LABEL_GAP + box_h
        return col_w, etiquetas, valores, n_etq, box_h, alto

    def alto_fila(self, campos):
        return self._medir_fila(campos)[-1] + ROW_GAP

    def field_row(self, campos, reservado=False):
        col_w, etiquetas, valores, n_etq, box_h, alto = self._medir_fila(campos)
        if not reservado:
            self._reservar(alto + ROW_GAP)
        c = self.c
        top = self.y
        box_top = top - n_etq * LABEL_LEADING - LABEL_GAP
        for i in range(len(campos)):
            x = MARGIN_X + i * (col_w + COL_GAP)
            c.setFont("Helvetica-Bold", LABEL_SIZE)
            c.setFillColorRGB(*TEXT_MUTED)
            for k, linea in enumerate(etiquetas[i]):
                c.drawString(x, top - (k + 1) * LABEL_LEADING + 0.9 * mm, linea)

            c.setFillColorRGB(*BOX_FILL)
            c.setStrokeColorRGB(*BOX_BORDER)
            c.setLineWidth(0.25 * mm)
            c.roundRect(x, box_top - box_h, col_w, box_h, 0.8 * mm, fill=1, stroke=1)

            c.setFont("Helvetica", VALUE_SIZE)
            c.setFillColorRGB(*(TEXT_MUTED if valores[i] == ["—"] else TEXT))
            for k, linea in enumerate(valores[i]):
                base = box_top - BOX_PAD_Y - k * VALUE_LEADING - (VALUE_LEADING / 2 + CAP_H / 2)
                c.drawString(x + BOX_PAD_X, base, linea)
        self.y = box_top - box_h - ROW_GAP

    def field(self, label, value, reservado=False):
        self.field_row([(label, value)], reservado=reservado)

    def grupo(self, subtitulo, filas):
        """Un registro (estudio, experiencia). Si no cabe en lo que queda de la página:
        - con poco espacio libre, pasa entero a la página siguiente;
        - con mucho espacio libre (para no dejar media página en blanco), se parte,
          dejando al menos 2 filas a cada lado y repitiendo el subtítulo con
          "(continuación)" en la página nueva."""
        alto = SUBTITLE_H + sum(self.alto_fila(f) for f in filas)
        extra = SECTION_H if self._titulo_pendiente else 0
        libre = self.y - LIMITE_INFERIOR - extra
        partir = alto > libre and (libre >= ESPACIO_MIN_PARA_PARTIR or not self._cabe_en_pagina_nueva(alto + extra))

        if not partir or len(filas) < 4:
            self._reservar(alto)
            self._subtitulo(subtitulo)
            for f in filas:
                self.field_row(f, reservado=True)
        else:
            altos = [self.alto_fila(f) for f in filas]
            self._reservar(SUBTITLE_H + altos[0] + altos[1])
            self._subtitulo(subtitulo)
            for k, f in enumerate(filas):
                # Las 2 primeras ya tienen espacio reservado; las 2 últimas viajan juntas.
                necesario = sum(altos[k:]) if len(filas) - k == 2 else altos[k]
                if k >= 2 and self.y - necesario < LIMITE_INFERIOR:
                    self._nueva_pagina()
                    self._subtitulo(f"{subtitulo} (continuación)")
                self.field_row(f, reservado=True)
        self.y -= 1.5 * mm

    def _subtitulo(self, texto):
        c = self.c
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColorRGB(*GREEN_800)
        c.drawString(MARGIN_X, self.y - 3.2 * mm, texto)
        c.setStrokeColorRGB(*GREEN_500)
        c.setLineWidth(0.4 * mm)
        c.line(MARGIN_X, self.y - 5 * mm, MARGIN_X + 30 * mm, self.y - 5 * mm)
        self.y -= SUBTITLE_H

    def legend(self, texto):
        self._reservar(9 * mm)
        c = self.c
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColorRGB(*TEXT_MUTED)
        c.drawString(MARGIN_X, self.y - 3 * mm, f"({texto})")
        self.y -= 9 * mm

    def paragraph_box(self, label, texto):
        """Texto largo en recuadro; si no cabe en lo que queda de página, continúa en la siguiente."""
        c = self.c
        lineas = _envolver(texto or "—", "Helvetica", 9, USABLE_W - 2 * BOX_PAD_X)
        leading = 4.4 * mm
        primera = True
        while lineas:
            etq_h = (LABEL_LEADING + LABEL_GAP) if primera else 0
            self._reservar(etq_h + leading * min(len(lineas), 3) + 2 * BOX_PAD_Y + ROW_GAP)
            if primera:
                c.setFont("Helvetica-Bold", LABEL_SIZE)
                c.setFillColorRGB(*TEXT_MUTED)
                c.drawString(MARGIN_X, self.y - LABEL_LEADING + 0.9 * mm, label.upper())
                self.y -= LABEL_LEADING + LABEL_GAP
            disponibles = max(int((self.y - LIMITE_INFERIOR - 2 * BOX_PAD_Y - ROW_GAP) // leading), 1)
            tramo, lineas = lineas[:disponibles], lineas[disponibles:]
            box_h = len(tramo) * leading + 2 * BOX_PAD_Y
            c.setFillColorRGB(*BOX_FILL)
            c.setStrokeColorRGB(*BOX_BORDER)
            c.setLineWidth(0.25 * mm)
            c.roundRect(MARGIN_X, self.y - box_h, USABLE_W, box_h, 0.8 * mm, fill=1, stroke=1)
            c.setFont("Helvetica", 9)
            c.setFillColorRGB(*TEXT)
            for k, linea in enumerate(tramo):
                c.drawString(MARGIN_X + BOX_PAD_X, self.y - BOX_PAD_Y - k * leading - 3.1 * mm, linea)
            self.y -= box_h + ROW_GAP
            primera = False
            if lineas:
                self._nueva_pagina()

    def gap(self, n=4):
        self.y -= n * mm

    def finalizar(self) -> bytes:
        self.c.showPage()
        self.c.save()
        return self.buffer.getvalue()


def _filas_registro(r) -> list:
    tipo = r.get("tipo")
    if tipo == "estudio":
        return [
            [("Nivel educativo", r.get("nivelEducativo")), ("¿Graduado?", _sino(r.get("graduado")))],
            [("Título", r.get("titulo"))],
            [("Establecimiento", r.get("establecimiento"))],
            [("Departamento", r.get("departamento")), ("Ciudad", r.get("ciudad"))],
            [("Inicio", _fecha(r.get("inicio"))), ("Terminación", _fecha(r.get("terminacion")))],
        ]
    if tipo == "educacionTrabajo":
        return [
            [("Nombre del evento", r.get("nombreEvento"))],
            [("Fecha del certificado", _fecha(r.get("fechaCertificado"))), ("N° de horas", r.get("numHoras"))],
            [("Establecimiento", r.get("establecimiento"))],
        ]
    if tipo == "certificacion":
        return [
            [("Nombre de la norma o certificado", r.get("nombreNorma"))],
            [("N° documento/norma", r.get("numDocumento")), ("Fecha del certificado", _fecha(r.get("fechaCertificado")))],
            [("Ente certificador", r.get("enteCertificador"))],
        ]
    if tipo == "idioma":
        return [
            [("Idioma", r.get("idioma")), ("Establecimiento", r.get("establecimiento")), ("Fecha", _fecha(r.get("fecha")))],
            # Los registros anteriores al cambio de escala traen una valoración por
            # habilidad; nivel_idioma_de_registro() los resuelve al nivel equivalente.
            [("Nivel de dominio", evaluacion_service.nivel_idioma_de_registro(r))],
        ]
    return [[("Descripción", r.get("titulo") or r.get("nombreEvento") or r.get("nombreNorma"))]]


def _filas_experiencia(e) -> list:
    fin = "Actualidad" if e.get("actual") else _fecha(e.get("fechaTerminacion"))
    return [
        [("Nombre de la empresa", e.get("empresa"))],
        # Mismo orden que en el formulario: País primero (define si Departamento/Ciudad
        # vienen de la lista DIVIPOLA o se escribieron libres — ver ExperienciaCard.jsx).
        [("País", e.get("pais")), ("Departamento/Estado", e.get("departamento")), ("Ciudad", e.get("ciudad"))],
        [("Tipo de empresa", e.get("tipoEmpresa")), ("Proceso en el cual laboró", e.get("proceso"))],
        [("Jefe inmediato", e.get("jefeInmediato")), ("Teléfono empresa", e.get("telEmpresa"))],
        [("Cargo desempeñado", e.get("cargo"))],
        [("Fecha inicio", _fecha(e.get("fechaInicio"))), ("Fecha terminación", fin)],
        [("Tiempo total laborado", e.get("tiempoLaborado")), ("Dedicación", e.get("dedicacion"))],
        [("Motivo de retiro", e.get("motivoRetiro"))],
    ]


def generar_pdf_solicitud(solicitud: dict) -> bytes:
    dp = solicitud.get("datos_personales") or {}
    radicado = solicitud.get("radicado") or "—"
    nombre = dp.get("nombreCompleto") or "Aspirante"
    cedula = dp.get("cedula")
    proceso_no = solicitud.get("vacante_proceso_no") or dp.get("proceso") or "—"
    recibida = _a_hora_colombia(solicitud.get("fecha_solicitud"))
    fecha_entrega = dp.get("fechaEntrega") or (recibida.strftime("%Y-%m-%d") if recibida else "—")
    fecha_solicitud = recibida.strftime("%d/%m/%Y %H:%M") if recibida else "—"

    pie = " · ".join(x for x in [f"Radicado {radicado}", nombre, f"C.C. {cedula}" if cedula else ""] if x)
    pdf = PdfBuilder(texto_pie=pie)

    detalle = " · ".join(
        x for x in [f"C.C. {cedula}" if cedula else "", f"Proceso {proceso_no}", solicitud.get("vacante_cargo") or ""] if x
    )
    pdf.ficha_resumen(nombre, detalle, radicado, fecha_solicitud)

    pdf.section_title("I", "DATOS PERSONALES Y FAMILIARES")
    pdf.field_row([("Proceso de selección No.", proceso_no), ("Fecha de entrega", _fecha(fecha_entrega))])
    pdf.field("Nombre completo", dp.get("nombreCompleto"))
    pdf.field_row([("Cédula No.", cedula), ("De (expedición)", dp.get("cedulaDe"))])
    pdf.field_row([
        ("Ciudad de nacimiento", dp.get("ciudadNacimiento")),
        ("Departamento", dp.get("deptoNacimiento")),
        ("País", dp.get("paisNacimiento")),
    ])
    licencia_txt = _sino(dp.get("licencia"))
    if dp.get("licencia") == "si":
        categorias = _categorias_licencia(dp)
        etiqueta = "Categorías" if len(categorias) > 1 else "Categoría"
        licencia_txt += f" ({etiqueta} {', '.join(categorias) or '—'})"
    pdf.field_row([("Fecha de nacimiento", _fecha(dp.get("fechaNacimiento"))), ("Licencia de conducción", licencia_txt)])
    pdf.field("Correo electrónico", dp.get("correo"))
    pdf.field("Dirección de residencia", dp.get("direccion"))
    pdf.field_row([("Municipio", dp.get("municipio")), ("Departamento", dp.get("deptoResidencia"))])
    pdf.field_row([("Teléfono residencia", dp.get("telResidencia")), ("Celular", dp.get("celular"))])
    pdf.field_row([
        ("Estado civil", dp.get("estadoCivil")),
        ("N° de hijos", dp.get("numHijos")),
        ("¿Tiene vehículo?", _sino(dp.get("tieneVehiculo"))),
    ])

    pdf.section_title("II", "ESTUDIOS, CURSOS, CERTIFICACIONES E IDIOMAS")
    registros = solicitud.get("registros_ii") or []
    if not registros:
        pdf.legend("El aspirante no registró estudios, cursos, certificaciones ni idiomas.")
    for i, r in enumerate(registros):
        tipo = r.get("tipo")
        etiqueta_tipo = TIPO_REGISTRO_LABELS.get(tipo) or r.get("tipoLabel") or tipo or ""
        pdf.grupo(f"Registro {i + 1} — {etiqueta_tipo}", _filas_registro(r))

    pdf.section_title("VI", "EXPERIENCIA LABORAL")
    experiencia = solicitud.get("experiencia") or []
    if not experiencia:
        pdf.legend("El aspirante no registró experiencia laboral.")
    for i, e in enumerate(experiencia):
        pdf.grupo(f"Experiencia {i + 1}", _filas_experiencia(e))

    pdf.section_title("VII", "DECLARACIÓN CONFLICTO DE INTERÉS")
    conf = solicitud.get("conflicto") or {}
    pdf.field("¿Tiene vínculo con empleados o directivos de Aguas Nacionales EPM?", _sino(conf.get("tieneVinculo")))
    if conf.get("tieneVinculo") == "si":
        for f in conf.get("familiares", []):
            pdf.field_row([("Parentesco", f.get("parentesco")), ("Nombre empleado", f.get("nombreEmpleado")), ("Cargo", f.get("cargo"))])
    pdf.field("¿Tiene otra inhabilidad o conflicto de interés que declarar?", _sino(conf.get("tieneOtraInhabilidad")))
    if conf.get("tieneOtraInhabilidad") == "si" and conf.get("descripcionInhabilidad"):
        pdf.paragraph_box("Descripción de la situación", conf.get("descripcionInhabilidad"))

    pdf.section_title("VIII", "AUTORIZACIÓN DEL ASPIRANTE")
    pdf.paragraph_box(
        "Declaración",
        "El aspirante declaró haber leído y aceptado la totalidad de las cláusulas del presente formato, "
        "incluyendo la autorización de tratamiento de datos personales conforme a la Ley 1581 de 2012, y "
        "reconoció la validez de la autorización enviada en cualquiera de sus modalidades.",
    )
    autorizacion = solicitud.get("autorizacion") or {}
    pdf.field("Autorización del aspirante (nombre completo)", autorizacion.get("nombreCompleto"))

    # Cierre: deja constancia del radicado y la fecha también al final del documento.
    pdf.ensure_space(14 * mm)
    pdf.gap(4)
    c = pdf.c
    c.setStrokeColorRGB(*GREEN_800)
    c.setLineWidth(0.4 * mm)
    c.line(MARGIN_X, pdf.y, RIGHT_X, pdf.y)
    pdf.y -= 5.5 * mm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(*GREEN_900)
    c.drawString(MARGIN_X, pdf.y, f"Radicado: {radicado}")
    c.setFont("Helvetica", 8.5)
    c.setFillColorRGB(*TEXT_MUTED)
    c.drawRightString(RIGHT_X, pdf.y, f"Fecha de solicitud: {fecha_solicitud}")

    return pdf.finalizar()
