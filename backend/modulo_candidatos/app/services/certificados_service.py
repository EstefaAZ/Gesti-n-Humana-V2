# ==============================================================
# modulo_candidatos / app/services/certificados_service.py
#
# Certificados laborales y de estudio DESPUÉS de la preselección.
# Para no almacenar adjuntos de candidatos que no pasan la revisión, el
# candidato solo puede adjuntarlos cuando Gestión Humana lo marca como
# "Preseleccionado", y tiene 3 días hábiles (Colombia) para hacerlo. Se
# guardan solo en la postulación (documentos_adjuntos), nunca en el perfil.
# ==============================================================

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.solicitud import Solicitud

CATEGORIAS_CERTIFICADOS = ("certificados_laborales", "certificados_estudio")
MAXIMO_POR_CATEGORIA = 10
DIAS_HABILES_PLAZO = 3

ESTADO_QUE_HABILITA = "Preseleccionado"
# Estados en que el candidato puede adjuntar (si el plazo no venció).
ESTADOS_CON_CERTIFICADOS = ("Preseleccionado", "Entrevista programada", "Aceptada")

# Colombia no tiene horario de verano: UTC-5 todo el año.
HORA_COLOMBIA = timezone(timedelta(hours=-5))


class CertificadosNoHabilitadosError(Exception):
    pass


class PlazoVencidoError(Exception):
    pass


class CertificadosVaciosError(Exception):
    pass


class DocumentoFaltanteError(Exception):
    pass


# ---------------------------------------------------------------
# Días hábiles en Colombia (Ley 51 de 1983, "Ley Emiliani")
# ---------------------------------------------------------------

def _domingo_de_pascua(anio: int) -> date:
    """Algoritmo de Meeus/Jones/Butcher (calendario gregoriano)."""
    a, b, c = anio % 19, anio // 100, anio % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes = (h + l - 7 * m + 114) // 31
    dia = ((h + l - 7 * m + 114) % 31) + 1
    return date(anio, mes, dia)


def _al_lunes_siguiente(dia: date) -> date:
    return dia + timedelta(days=(7 - dia.weekday()) % 7)


def festivos_colombia(anio: int) -> set[date]:
    """Los 18 festivos nacionales de Colombia para `anio`."""
    fijos = {date(anio, 1, 1), date(anio, 5, 1), date(anio, 7, 20), date(anio, 8, 7), date(anio, 12, 8), date(anio, 12, 25)}
    trasladables = {_al_lunes_siguiente(date(anio, m, d)) for m, d in ((1, 6), (3, 19), (6, 29), (8, 15), (10, 12), (11, 1), (11, 11))}
    pascua = _domingo_de_pascua(anio)
    semana_santa = {pascua - timedelta(days=3), pascua - timedelta(days=2)}  # Jueves y Viernes Santo
    # Ascensión, Corpus Christi y Sagrado Corazón se trasladan al lunes siguiente.
    moviles = {pascua + timedelta(days=43), pascua + timedelta(days=64), pascua + timedelta(days=71)}
    return fijos | trasladables | semana_santa | moviles


def es_dia_habil(dia: date) -> bool:
    return dia.weekday() < 5 and dia not in festivos_colombia(dia.year)


def calcular_plazo(desde: datetime, dias_habiles: int = DIAS_HABILES_PLAZO) -> datetime:
    """
    Fin (23:59:59, hora Colombia) del N-ésimo día hábil DESPUÉS del día de
    `desde`. Preseleccionado el miércoles 25/11/2026 -> vence el lunes 30/11.
    """
    dia = desde.astimezone(HORA_COLOMBIA).date()
    contados = 0
    while contados < dias_habiles:
        dia += timedelta(days=1)
        if es_dia_habil(dia):
            contados += 1
    return datetime.combine(dia, time(23, 59, 59), tzinfo=HORA_COLOMBIA).astimezone(timezone.utc)


_DIAS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
_MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
          "septiembre", "octubre", "noviembre", "diciembre")


def texto_plazo(plazo: datetime) -> str:
    """"lunes 30 de noviembre de 2026" (el plazo vence a las 11:59 p. m. de ese día)."""
    dia = plazo.astimezone(HORA_COLOMBIA)
    return f"{_DIAS[dia.weekday()]} {dia.day} de {_MESES[dia.month - 1]} de {dia.year}"


# ---------------------------------------------------------------
# Estado de los certificados de una postulación
# ---------------------------------------------------------------

def _como_fecha(valor) -> datetime | None:
    if not valor:
        return None
    fecha = datetime.fromisoformat(valor) if isinstance(valor, str) else valor
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


def resumen(solicitud: Solicitud, ahora: datetime | None = None) -> dict | None:
    """
    None si a esta postulación todavía no se le piden certificados. Si no:
    {estado: pendientes|recibidos|vencidos, habilitados_en, plazo, enviados_en, ampliaciones}.
    """
    meta = solicitud.certificados_meta or None
    if not meta:
        return None
    ahora = ahora or datetime.now(timezone.utc)
    plazo = _como_fecha(meta.get("plazo"))
    enviados = _como_fecha(meta.get("enviados_en"))
    if enviados:
        estado = "recibidos"
    elif plazo and ahora > plazo:
        estado = "vencidos"
    else:
        estado = "pendientes"
    return {
        "estado": estado,
        "habilitados_en": _como_fecha(meta.get("habilitados_en")),
        "plazo": plazo,
        "enviados_en": enviados,
        "ampliaciones": meta.get("ampliaciones", 0),
        "puede_adjuntar": puede_adjuntar(solicitud, ahora),
    }


def puede_adjuntar(solicitud: Solicitud, ahora: datetime | None = None) -> bool:
    meta = solicitud.certificados_meta or None
    if not meta or solicitud.estado not in ESTADOS_CON_CERTIFICADOS:
        return False
    plazo = _como_fecha(meta.get("plazo"))
    return not plazo or (ahora or datetime.now(timezone.utc)) <= plazo


def habilitar_si_corresponde(solicitud: Solicitud, ahora: datetime | None = None) -> bool:
    """Al pasar a Preseleccionado por primera vez, abre el plazo. Devuelve True si lo abrió."""
    if solicitud.estado != ESTADO_QUE_HABILITA or solicitud.certificados_meta:
        return False
    ahora = ahora or datetime.now(timezone.utc)
    solicitud.certificados_meta = {
        "habilitados_en": ahora.isoformat(),
        "plazo": calcular_plazo(ahora).isoformat(),
        "enviados_en": None,
        "ampliaciones": 0,
    }
    return True


def ampliar_plazo(db: Session, solicitud: Solicitud, ahora: datetime | None = None) -> Solicitud:
    """Gestión Humana da 3 días hábiles más, contados desde hoy."""
    if not solicitud.certificados_meta:
        raise CertificadosNoHabilitadosError("A esta postulación todavía no se le piden certificados.")
    ahora = ahora or datetime.now(timezone.utc)
    meta = dict(solicitud.certificados_meta)
    meta["plazo"] = calcular_plazo(ahora).isoformat()
    meta["ampliaciones"] = meta.get("ampliaciones", 0) + 1
    solicitud.certificados_meta = meta
    db.commit()
    db.refresh(solicitud)
    return solicitud


def guardar_certificados(db: Session, solicitud: Solicitud, nuevos: dict, ahora: datetime | None = None) -> Solicitud:
    """
    Reemplaza los certificados de la postulación. `nuevos` es
    {categoria: [{nombre, contenido_base64 | None}]}: los que vienen sin
    contenido son archivos ya subidos que se conservan (se buscan por nombre).
    """
    ahora = ahora or datetime.now(timezone.utc)
    if not solicitud.certificados_meta or solicitud.estado not in ESTADOS_CON_CERTIFICADOS:
        raise CertificadosNoHabilitadosError(
            "Solo puedes adjuntar certificados cuando Gestión Humana te preselecciona en este proceso."
        )
    if not puede_adjuntar(solicitud, ahora):
        plazo = _como_fecha(solicitud.certificados_meta.get("plazo")).astimezone(HORA_COLOMBIA)
        raise PlazoVencidoError(
            f"El plazo para adjuntar los certificados venció el {plazo:%d/%m/%Y}. Escribe a Gestión Humana si necesitas más tiempo."
        )

    documentos = dict(solicitud.documentos_adjuntos or {})
    total = 0
    for categoria in CATEGORIAS_CERTIFICADOS:
        existentes = {d["nombre"]: d for d in documentos.get(categoria, [])}
        lista = []
        for doc in nuevos.get(categoria, [])[:MAXIMO_POR_CATEGORIA]:
            if doc.get("contenido_base64"):
                lista.append({"nombre": doc["nombre"], "contenido_base64": doc["contenido_base64"]})
            elif doc["nombre"] in existentes:
                lista.append(existentes[doc["nombre"]])
            else:
                raise DocumentoFaltanteError(f'No se encontró el archivo "{doc["nombre"]}"; vuelve a adjuntarlo.')
        documentos[categoria] = lista
        total += len(lista)
    if total == 0:
        raise CertificadosVaciosError("Adjunta al menos un certificado laboral o de estudio.")

    solicitud.documentos_adjuntos = documentos
    meta = dict(solicitud.certificados_meta)
    meta["enviados_en"] = ahora.isoformat()
    solicitud.certificados_meta = meta
    db.commit()
    db.refresh(solicitud)
    return solicitud
