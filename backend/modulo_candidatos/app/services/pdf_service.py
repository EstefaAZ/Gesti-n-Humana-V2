# ==============================================================
# modulo_candidatos / app/services/pdf_service.py
# Genera el PDF plano de la solicitud — mismo diseño acordado en el
# frontend (encabezado de 3 columnas, franjas verdes por sección,
# campos en recuadro), ahora generado en el backend.
# ==============================================================

import os
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

RUTA_LOGO = os.path.join(os.path.dirname(__file__), "..", "resources", "logo-aguas-nacionales.png")

MARGIN_X = 15 * mm
RIGHT_X = 195 * mm
USABLE_W = RIGHT_X - MARGIN_X
PAGE_W, PAGE_H = A4
MAX_Y = PAGE_H - 17 * mm  # margen inferior

GREEN_900 = (0 / 255, 77 / 255, 32 / 255)
GREEN_800 = (0 / 255, 98 / 255, 40 / 255)
GREEN_500 = (46 / 255, 160 / 255, 74 / 255)
TEXT = (27 / 255, 43 / 255, 34 / 255)
TEXT_MUTED = (91 / 255, 107 / 255, 96 / 255)
BORDER = (30 / 255, 30 / 255, 30 / 255)

HEADER_TOP_FROM_TOP = 10 * mm
HEADER_H = 20 * mm
COL_LOGO_W = 40 * mm
COL_CODE_W = 45 * mm
COL_TITLE_W = USABLE_W - COL_LOGO_W - COL_CODE_W

LABEL_H = 4 * mm
BOX_H = 7.2 * mm
COL_GAP = 4 * mm
ROW_GAP = 3 * mm


def _sino(v) -> str:
    return "Sí" if v in (True, "si", "Si", "sí") else "No"


class PdfBuilder:
    def __init__(self):
        self.buffer = BytesIO()
        self.c = canvas.Canvas(self.buffer, pagesize=A4)
        self.y = PAGE_H - 20 * mm  # reportlab: origen (0,0) abajo-izquierda
        self._draw_header()

    def _y_from_top(self, mm_from_top):
        return PAGE_H - mm_from_top

    def ensure_space(self, next_h):
        if self.y - next_h < (PAGE_H - MAX_Y):
            self.c.showPage()
            self._draw_header()

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

        # Celda título
        c.setFont("Helvetica-BoldOblique", 11.5)
        c.setFillColorRGB(*TEXT)
        titulo_cx = x2 + COL_TITLE_W / 2
        c.drawCentredString(titulo_cx, top_y - 9 * mm, "Solicitud de Inscripción a Proceso de")
        c.drawCentredString(titulo_cx, top_y - 15 * mm, "Selección")

        # Celda código
        c.setFont("Helvetica-BoldOblique", 8)
        codigo_cx = x3 + COL_CODE_W / 2
        c.drawCentredString(codigo_cx, top_y - 7 * mm, "Código: GTH-FOR-03")
        c.drawCentredString(codigo_cx, top_y - 12 * mm, "Versión: 02")
        c.drawCentredString(codigo_cx, top_y - 17 * mm, "Fecha: 03/08/2023")

        self.y = bottom_y - 8 * mm

    def start_new_page(self):
        self.c.showPage()
        self._draw_header()

    def section_title(self, numeral, texto):
        self.ensure_space(14 * mm)
        c = self.c
        bar_h = 8 * mm
        c.setFillColorRGB(*GREEN_800)
        c.rect(MARGIN_X, self.y - bar_h, USABLE_W, bar_h, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColorRGB(1, 1, 1)
        c.drawString(MARGIN_X + 3 * mm, self.y - bar_h + 2.4 * mm, f"{numeral}.  {texto}")
        self.y -= bar_h + 5 * mm

    def subtitle(self, texto):
        self.ensure_space(8 * mm)
        c = self.c
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColorRGB(*GREEN_800)
        c.drawString(MARGIN_X, self.y, texto)
        self.y -= 2 * mm
        c.setStrokeColorRGB(*GREEN_500)
        c.setLineWidth(0.4 * mm)
        c.line(MARGIN_X, self.y, MARGIN_X + 30 * mm, self.y)
        self.y -= 4.5 * mm

    def _field_box(self, x, w, label, value):
        c = self.c
        c.setFont("Helvetica-Bold", 7.3)
        c.setFillColorRGB(*TEXT_MUTED)
        c.drawString(x, self.y, label.upper())

        box_y = self.y - LABEL_H - BOX_H
        c.setFillColorRGB(1, 1, 1)
        c.setStrokeColorRGB(*BORDER)
        c.setLineWidth(0.25 * mm)
        c.rect(x, box_y, w, BOX_H, fill=1, stroke=1)

        c.setFont("Helvetica", 9.5)
        c.setFillColorRGB(*TEXT)
        texto = str(value if value not in (None, "") else "—").strip() or "—"
        c.drawString(x + 2 * mm, box_y + BOX_H / 2 - 1.2, texto[:90])

    def field_row(self, campos):
        self.ensure_space(LABEL_H + BOX_H + ROW_GAP)
        n = len(campos)
        col_w = (USABLE_W - COL_GAP * (n - 1)) / n
        for i, (label, value) in enumerate(campos):
            x = MARGIN_X + i * (col_w + COL_GAP)
            self._field_box(x, col_w, label, value)
        self.y -= LABEL_H + BOX_H + ROW_GAP

    def field(self, label, value):
        self.field_row([(label, value)])

    def legend(self, texto):
        self.ensure_space(9 * mm)
        c = self.c
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColorRGB(*TEXT_MUTED)
        c.drawString(MARGIN_X, self.y, f"({texto})")
        self.y -= 8 * mm

    def paragraph_box(self, label, texto):
        c = self.c
        c.setFont("Helvetica-Bold", 7.3)
        self.ensure_space(LABEL_H + 14 * mm)
        c.setFillColorRGB(*TEXT_MUTED)
        c.drawString(MARGIN_X, self.y, label.upper())
        box_y = self.y - LABEL_H

        from reportlab.pdfbase.pdfmetrics import stringWidth
        palabras = (texto or "—").split(" ")
        lineas, actual = [], ""
        for palabra in palabras:
            prueba = f"{actual} {palabra}".strip()
            if stringWidth(prueba, "Helvetica", 9) > USABLE_W - 4 * mm:
                lineas.append(actual)
                actual = palabra
            else:
                actual = prueba
        if actual:
            lineas.append(actual)

        box_h = max(BOX_H, len(lineas) * 4.4 * mm + 3 * mm)
        c.setFillColorRGB(1, 1, 1)
        c.setStrokeColorRGB(*BORDER)
        c.rect(MARGIN_X, box_y - box_h, USABLE_W, box_h, fill=1, stroke=1)
        c.setFont("Helvetica", 9)
        c.setFillColorRGB(*TEXT)
        for i, linea in enumerate(lineas):
            c.drawString(MARGIN_X + 2 * mm, box_y - 4.6 * mm - i * 4.4 * mm, linea)

        self.y = box_y - box_h - ROW_GAP

    def gap(self, n=4):
        self.y -= n * mm

    def finalizar(self) -> bytes:
        self.c.save()
        return self.buffer.getvalue()


def generar_pdf_solicitud(solicitud: dict) -> bytes:
    pdf = PdfBuilder()
    dp = solicitud.get("datos_personales") or {}

    proceso_no = solicitud.get("vacante_proceso_no") or dp.get("proceso") or "—"
    fecha_entrega = dp.get("fechaEntrega") or str(solicitud.get("fecha_solicitud") or "")[:10] or "—"

    pdf.section_title("I", "DATOS PERSONALES Y FAMILIARES")
    pdf.field_row([("Proceso de selección No.", proceso_no), ("Fecha de entrega", fecha_entrega)])
    pdf.field("Nombre completo", dp.get("nombreCompleto"))
    pdf.field_row([("Cédula No.", dp.get("cedula")), ("De (expedición)", dp.get("cedulaDe"))])
    pdf.field_row([
        ("Ciudad de nacimiento", dp.get("ciudadNacimiento")),
        ("Departamento", dp.get("deptoNacimiento")),
        ("País", dp.get("paisNacimiento")),
    ])
    licencia_txt = _sino(dp.get("licencia")) + (f" (Clase {dp.get('licenciaClase') or '—'})" if dp.get("licencia") == "si" else "")
    pdf.field_row([("Fecha de nacimiento", dp.get("fechaNacimiento")), ("Licencia de conducción", licencia_txt)])
    pdf.field("Correo electrónico", dp.get("correo"))
    pdf.field("Dirección de residencia", dp.get("direccion"))
    pdf.field_row([("Municipio", dp.get("municipio")), ("Departamento", dp.get("deptoResidencia"))])
    pdf.field_row([("Teléfono residencia", dp.get("telResidencia")), ("Celular", dp.get("celular"))])
    pdf.field_row([
        ("Estado civil", dp.get("estadoCivil")),
        ("N° de hijos", dp.get("numHijos")),
        ("¿Tiene vehículo?", _sino(dp.get("tieneVehiculo"))),
    ])

    pdf.start_new_page()
    pdf.section_title("II", "ESTUDIOS, CURSOS, CERTIFICACIONES E IDIOMAS")
    registros = solicitud.get("registros_ii") or []
    if not registros:
        pdf.legend("El aspirante no registró estudios, cursos, certificaciones ni idiomas.")
    else:
        for i, r in enumerate(registros):
            pdf.subtitle(f"Registro {i + 1} — {r.get('tipoLabel', r.get('tipo', ''))}")
            tipo = r.get("tipo")
            if tipo == "estudio":
                pdf.field_row([("Nivel educativo", r.get("nivelEducativo")), ("¿Graduado?", _sino(r.get("graduado")))])
                pdf.field("Título", r.get("titulo"))
                pdf.field_row([("Establecimiento", r.get("establecimiento")), ("Ciudad", r.get("ciudad"))])
                pdf.field_row([("Inicio", r.get("inicio")), ("Terminación", r.get("terminacion"))])
            elif tipo == "educacionTrabajo":
                pdf.field("Nombre del evento", r.get("nombreEvento"))
                pdf.field_row([("Fecha del certificado", r.get("fechaCertificado")), ("N° de horas", r.get("numHoras"))])
                pdf.field("Establecimiento", r.get("establecimiento"))
            elif tipo == "certificacion":
                pdf.field("Nombre de la norma o certificado", r.get("nombreNorma"))
                pdf.field_row([("N° documento/norma", r.get("numDocumento")), ("Fecha del certificado", r.get("fechaCertificado"))])
                pdf.field("Ente certificador", r.get("enteCertificador"))
            elif tipo == "idioma":
                pdf.field_row([("Idioma", r.get("idioma")), ("Establecimiento", r.get("establecimiento")), ("Fecha", r.get("fecha"))])
                pdf.field_row([("Lo habla", r.get("habla")), ("Lo lee", r.get("lee")), ("Lo escribe", r.get("escribe"))])
            pdf.gap(2)

    pdf.start_new_page()
    pdf.section_title("VI", "EXPERIENCIA LABORAL")
    experiencia = solicitud.get("experiencia") or []
    if not experiencia:
        pdf.legend("El aspirante no registró experiencia laboral.")
    else:
        for i, e in enumerate(experiencia):
            pdf.subtitle(f"Experiencia {i + 1}")
            pdf.field("Nombre de la empresa", e.get("empresa"))
            pdf.field_row([("Ciudad", e.get("ciudad")), ("Departamento", e.get("departamento")), ("País", e.get("pais"))])
            pdf.field_row([("Tipo de empresa", e.get("tipoEmpresa")), ("Proceso en el cual laboró", e.get("proceso"))])
            pdf.field_row([("Jefe inmediato", e.get("jefeInmediato")), ("Teléfono empresa", e.get("telEmpresa"))])
            pdf.field("Cargo desempeñado", e.get("cargo"))
            fin = "Actualidad" if e.get("actual") else e.get("fechaTerminacion")
            pdf.field_row([("Fecha inicio", e.get("fechaInicio")), ("Fecha terminación", fin)])
            pdf.field_row([("Tiempo total laborado", e.get("tiempoLaborado")), ("Dedicación", e.get("dedicacion"))])
            pdf.field("Motivo de retiro", e.get("motivoRetiro"))
            pdf.gap(2)

    pdf.start_new_page()
    pdf.section_title("VII", "DECLARACIÓN CONFLICTO DE INTERÉS")
    conf = solicitud.get("conflicto") or {}
    pdf.field("¿Tiene vínculo con empleados o directivos de Aguas Nacionales EPM?", _sino(conf.get("tieneVinculo")))
    if conf.get("tieneVinculo") == "si":
        for f in conf.get("familiares", []):
            pdf.field_row([("Parentesco", f.get("parentesco")), ("Nombre empleado", f.get("nombreEmpleado")), ("Cargo", f.get("cargo"))])
    pdf.field("¿Tiene otra inhabilidad o conflicto de interés que declarar?", _sino(conf.get("tieneOtraInhabilidad")))
    if conf.get("tieneOtraInhabilidad") == "si" and conf.get("descripcionInhabilidad"):
        pdf.paragraph_box("Descripción de la situación", conf.get("descripcionInhabilidad"))

    pdf.start_new_page()
    pdf.section_title("VIII", "AUTORIZACIÓN DEL ASPIRANTE")
    pdf.paragraph_box(
        "Declaración",
        "El aspirante declaró haber leído y aceptado la totalidad de las cláusulas del presente formato, "
        "incluyendo la autorización de tratamiento de datos personales conforme a la Ley 1581 de 2012, y "
        "reconoció la validez de la autorización enviada en cualquiera de sus modalidades.",
    )
    autorizacion = solicitud.get("autorizacion") or {}
    pdf.field("Autorización del aspirante (nombre completo)", autorizacion.get("nombreCompleto"))

    pdf.gap(8)
    c = pdf.c
    c.setStrokeColorRGB(*GREEN_800)
    c.setLineWidth(0.4 * mm)
    c.line(MARGIN_X, pdf.y, RIGHT_X, pdf.y)
    pdf.y -= 6 * mm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(*GREEN_900)
    c.drawString(MARGIN_X, pdf.y, f"Radicado: {solicitud.get('radicado', '')}")
    c.setFont("Helvetica", 8.5)
    c.setFillColorRGB(*TEXT_MUTED)
    fecha_txt = str(solicitud.get("fecha_solicitud") or "").replace("T", " ")[:16]
    c.drawString(MARGIN_X, pdf.y - 5 * mm, f"Fecha de solicitud: {fecha_txt}")

    return pdf.finalizar()
