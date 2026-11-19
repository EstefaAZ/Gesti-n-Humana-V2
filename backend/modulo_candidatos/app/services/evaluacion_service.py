# ==============================================================
# modulo_candidatos / app/services/evaluacion_service.py
#
# Evaluación automática — SOLO INFORMATIVA.
# Nunca bloquea el envío de una solicitud; únicamente le da a Gestión Humana
# una etiqueta ("Cumple" / "No cumple") con los motivos, para priorizar la
# revisión. La decisión final siempre la toma una persona.
#
# Todos los criterios de la vacante se leen como MÍNIMOS: superar el nivel
# pedido (educativo o de idioma) también cumple. Nunca se comparan por igualdad.
# ==============================================================

import re
import unicodedata
from datetime import datetime
from typing import Any

# Jerarquías: todo criterio de la vacante es un MÍNIMO, así que la comparación
# siempre es "ordinal del candidato >= ordinal exigido". Un Universitario cumple
# un requisito de Técnico; un nivel Experto cumple uno de Intermedio.
NIVEL_EDUCATIVO_ORDEN = {"": 0, "Secundarios": 1, "Técnico": 2, "Tecnólogo": 3, "Universitario": 4, "Postgrado": 5}
NIVEL_IDIOMA_ORDEN = {"": 0, "Básico": 1, "Intermedio": 2, "Avanzado": 3, "Experto": 4}

# Sinónimos frecuentes que el aspirante puede haber escrito (o que quedaron en
# datos importados). Sin esto caerían al ordinal 0 y se descartarían por error.
# Las claves van sin tildes y en minúscula: la búsqueda normaliza antes.
NIVEL_EDUCATIVO_SINONIMOS = {
    "bachiller": "Secundarios", "bachillerato": "Secundarios", "secundaria": "Secundarios",
    "media": "Secundarios", "tecnica": "Técnico", "tecnologia": "Tecnólogo",
    "pregrado": "Universitario", "profesional": "Universitario", "universitaria": "Universitario",
    "especializacion": "Postgrado", "maestria": "Postgrado", "magister": "Postgrado",
    "doctorado": "Postgrado", "phd": "Postgrado", "posgrado": "Postgrado",
}

# Escala de idioma anterior (una valoración por habilidad: "Lo habla / Lo lee /
# Lo escribe"). Se conserva SOLO para leer registros y vacantes ya guardados.
NIVEL_IDIOMA_ANTERIOR = {"Regular": "Básico", "Bien": "Intermedio", "Muy bien": "Avanzado"}
HABILIDADES_IDIOMA_ANTERIORES = ("habla", "lee", "escribe")


def _clave(texto) -> str:
    """minúsculas y sin tildes — para que "Tecnico", "Técnico" y "TÉCNICO" sean lo mismo."""
    sin_tildes = unicodedata.normalize("NFD", (texto or "").strip())
    return "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn").lower()


def _buscar_canonico(valor, opciones: dict) -> str:
    """Devuelve la clave oficial de `opciones` que corresponde a `valor`, o ""."""
    clave = _clave(valor)
    return next((oficial for oficial in opciones if _clave(oficial) == clave), "")


# Terminaciones de género/número más comunes en español. Se prueban de la más
# larga a la más corta para no cortar de más (p. ej. "ia" antes que "a").
_SUFIJOS_VARIABLES = ("es", "as", "os", "ia", "a", "o", "e", "s")


def _raiz(palabra) -> str:
    """
    Raíz aproximada de una palabra: quita la terminación de género/número más
    común para que "ingeniero", "ingeniera" e "ingenieria" compartan la misma
    raíz ("ingenier"). No es un stemmer completo — alcanza para keywords
    cortos de profesión/título, que es todo lo que necesita este matching.
    """
    clave = _clave(palabra)
    for sufijo in _SUFIJOS_VARIABLES:
        if clave.endswith(sufijo) and len(clave) - len(sufijo) >= 4:
            return clave[: -len(sufijo)]
    return clave


# Palabras de enlace que no cambian el sentido de un título o curso: así
# "Ingeniería de Sistemas" y "Ingeniero en Sistemas" se comparan igual.
_PALABRAS_VACIAS = {"de", "del", "la", "las", "el", "los", "en", "y", "e", "para", "con", "a", "al"}


def _tokens(texto) -> list[str]:
    """Palabras de `texto` sin tildes ni mayúsculas, separando por cualquier signo
    (espacio, guion, coma, paréntesis…) y sin palabras de enlace. "Power-BI" y
    "Power BI" dan los mismos tokens."""
    return [t for t in re.split(r"[^a-z0-9]+", _clave(texto)) if t and t not in _PALABRAS_VACIAS]


def _misma_palabra(a: str, b: str) -> bool:
    """Igual, o igual salvo la terminación de género/número (ingeniero / ingeniería)."""
    return a == b or _raiz(a) == _raiz(b)


def _coincide_por_ventaneo(texto_tokens, kw_tokens) -> bool:
    """
    True si alguna secuencia de tokens consecutivos de `texto_tokens`, unida
    sin separador, es EXACTAMENTE igual al keyword unido sin separador. Así
    "Power BI" (keyword) reconoce "PowerBI" (texto) y al revés. Es igualdad
    exacta de la ventana completa: "ISO 9001" nunca confunde con "ISO 14001".
    """
    kw_compacto = "".join(kw_tokens)
    if not kw_compacto:
        return False
    for i in range(len(texto_tokens)):
        acumulado = ""
        for j in range(i, len(texto_tokens)):
            acumulado += texto_tokens[j]
            if acumulado == kw_compacto:
                return True
            if len(acumulado) > len(kw_compacto):
                break
    return False


def _texto_incluye_keyword(texto, keyword) -> bool:
    """
    True si las palabras de `keyword` aparecen seguidas, como palabras completas,
    en `texto`. Tolera tildes, mayúsculas, palabras de enlace y la terminación de
    género/número de CADA palabra ("Ingeniero Civil" cumple "Ingeniería Civil").
    No acepta pedazos de palabra: "Excel" no coincide con "Excelencia", ni
    "Java" con "JavaScript". Como último recurso compara sin espacios
    ("PowerBI" cumple "Power BI").
    """
    kw = _tokens(keyword)
    if not kw:
        return False
    palabras = _tokens(texto)
    n = len(kw)
    for i in range(len(palabras) - n + 1):
        if all(_misma_palabra(palabras[i + k], kw[k]) for k in range(n)):
            return True
    return _coincide_por_ventaneo(palabras, kw)


def _nivel_educativo_ordinal(valor) -> int:
    """Ordinal del nivel educativo, tolerante a sinónimos, mayúsculas y tildes."""
    oficial = _buscar_canonico(valor, NIVEL_EDUCATIVO_ORDEN)
    if oficial:
        return NIVEL_EDUCATIVO_ORDEN[oficial]
    sinonimo = NIVEL_EDUCATIVO_SINONIMOS.get(_clave(valor))
    return NIVEL_EDUCATIVO_ORDEN.get(sinonimo, 0)


def nivel_idioma_normalizado(valor) -> str:
    """Traduce un nivel de la escala anterior a la actual; deja pasar los ya válidos."""
    anterior = _buscar_canonico(valor, NIVEL_IDIOMA_ANTERIOR)
    if anterior:
        return NIVEL_IDIOMA_ANTERIOR[anterior]
    return _buscar_canonico(valor, NIVEL_IDIOMA_ORDEN)


def nivel_idioma_de_registro(registro: dict[str, Any]) -> str:
    """
    Nivel de dominio de un registro de idioma del Registro II. Usa el campo
    nuevo (`nivel`) y, si el registro es anterior al cambio de escala, toma la
    mejor de las tres habilidades — es la lectura más justa para el aspirante,
    que no eligió la migración.
    """
    nivel = nivel_idioma_normalizado(registro.get("nivel"))
    if nivel:
        return nivel
    anteriores = [nivel_idioma_normalizado(registro.get(h)) for h in HABILIDADES_IDIOMA_ANTERIORES]
    return max(anteriores, key=lambda n: NIVEL_IDIOMA_ORDEN.get(n, 0), default="")


def _parsear_fecha(valor) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(str(valor)[:10])
    except ValueError:
        return None


def _total_experiencia_anios(experiencia: list[dict[str, Any]]) -> float:
    """
    Años de experiencia = tiempo real transcurrido, no la suma nominal de cada
    registro. Dos experiencias que se solapan (empleos simultáneos, o un error
    de digitación en las fechas) se fusionan en un solo intervalo antes de
    sumar — así no se cuenta dos veces el mismo período. Solo cuenta tiempo
    ya transcurrido y con fechas completas.
    """
    hoy = datetime.now()
    intervalos = []
    for e in experiencia:
        inicio = _parsear_fecha(e.get("fechaInicio"))
        if inicio is None or inicio > hoy:
            continue
        if e.get("actual"):
            fin = hoy
        else:
            # Sin fecha de terminación (y sin marcar "trabajo actual") no se puede
            # saber cuánto duró: no suma, en vez de contarse hasta hoy.
            fin = _parsear_fecha(e.get("fechaTerminacion"))
            if fin is None:
                continue
        # Una fecha futura (error de digitación) no suma tiempo que aún no pasó.
        fin = min(fin, hoy)
        if fin < inicio:
            continue
        intervalos.append((inicio, fin))

    if not intervalos:
        return 0.0

    intervalos.sort(key=lambda par: par[0])
    total_dias = 0
    cur_inicio, cur_fin = intervalos[0]
    for inicio, fin in intervalos[1:]:
        if inicio <= cur_fin:
            cur_fin = max(cur_fin, fin)
        else:
            total_dias += (cur_fin - cur_inicio).days
            cur_inicio, cur_fin = inicio, fin
    total_dias += (cur_fin - cur_inicio).days

    return total_dias / 365.25


def _formatear_anios_a_texto(valor: float) -> str:
    """
    Convierte años decimales a texto natural en español: "11 meses", "1 año",
    "2 años", "1 año y 4 meses". Trunca a meses completos (no redondea hacia
    arriba) — así el mensaje nunca muestra, para un candidato que NO cumple,
    un valor que visualmente parece alcanzar el mínimo exigido (ej. 1.958
    años nunca se ve como "2 años" cuando en realidad no llega a 2).
    """
    total_meses = int(valor * 12 + 1e-9)  # +epsilon: absorbe ruido de coma flotante, no redondea meses reales
    anios, meses = divmod(total_meses, 12)

    def _pluralizar(cantidad, singular, plural):
        return f"{cantidad} {singular if cantidad == 1 else plural}"

    if anios == 0 and meses == 0:
        return "0 meses"
    if anios == 0:
        return _pluralizar(meses, "mes", "meses")
    if meses == 0:
        return _pluralizar(anios, "año", "años")
    return f"{_pluralizar(anios, 'año', 'años')} y {_pluralizar(meses, 'mes', 'meses')}"


def evaluar_postulacion(solicitud: dict[str, Any], vacante: dict[str, Any]) -> dict:
    """
    Evaluación automática — SOLO INFORMATIVA (ver nota del módulo). Además del
    resultado general (cumple/motivos, para el badge del panel), devuelve un
    desglose por categoría (detalle.estudios/conocimientos/experiencia) — lo
    usa el reporte GTH-FOR-03 → hoja Traspaso_a_FOR-04, que las separa así.
    `cumple: None` en una categoría significa "esta vacante no tiene ese
    criterio configurado", no que el candidato haya fallado en algo.
    """
    motivos: list[str] = []
    criterios = (vacante or {}).get("criterios") or {}
    dp = solicitud.get("datos_personales") or solicitud.get("datosPersonales") or {}
    registros = solicitud.get("registros_ii") or solicitud.get("registrosII") or []
    experiencia = solicitud.get("experiencia") or []

    detalle = {
        "estudios": {"cumple": None, "motivo": None},
        "conocimientos": {"cumple": None, "motivo": None},
        "experiencia": {"cumple": None, "motivo": None},
    }

    # --- Estudios: nivel educativo mínimo y profesión/título (los dos van en la
    # misma columna del GTH-FOR-04). Basta con que uno falle para marcar NO.
    motivos_estudios: list[str] = []
    nivel_min = criterios.get("nivel_educativo_min")
    if nivel_min:
        graduado_requerido = criterios.get("graduado_requerido", True)
        max_nivel = 0
        for r in registros:
            if r.get("tipo") == "estudio":
                graduado_ok = (not graduado_requerido) or r.get("graduado") == "si"
                nivel = _nivel_educativo_ordinal(r.get("nivelEducativo"))
                if graduado_ok and nivel > max_nivel:
                    max_nivel = nivel
        if max_nivel < _nivel_educativo_ordinal(nivel_min):
            sufijo = " con graduación confirmada" if graduado_requerido else ""
            motivos_estudios.append(f'No registra nivel educativo "{nivel_min}" o superior{sufijo}.')

    profesion_kw = criterios.get("profesion_keyword")
    if profesion_kw:
        match = any(
            r.get("tipo") == "estudio" and _texto_incluye_keyword(r.get("titulo"), profesion_kw) for r in registros
        ) or _texto_incluye_keyword(dp.get("profesion"), profesion_kw)
        if not match:
            motivos_estudios.append(f'Ningún título/profesión registrada incluye "{profesion_kw}".')

    if nivel_min or profesion_kw:
        motivos.extend(motivos_estudios)
        detalle["estudios"] = {
            "cumple": not motivos_estudios,
            "motivo": " ".join(motivos_estudios) or None,
        }

    def _marcar_conocimientos(cumple: bool, motivo: str):
        actual = detalle["conocimientos"]
        # Si ya había un "no cumple" registrado, uno que sí cumple no lo revierte —
        # basta con que UN criterio de conocimientos falle para marcar la categoría en NO.
        if actual["cumple"] is False:
            return
        detalle["conocimientos"] = {"cumple": cumple, "motivo": None if cumple else motivo}

    exp_min = criterios.get("experiencia_min_anios")
    # 0 es un requisito válido (p. ej. practicantes): se evalúa y siempre cumple.
    if exp_min is not None and exp_min != "":
        total = _total_experiencia_anios(experiencia)
        cumple_exp = total >= float(exp_min)
        if not cumple_exp:
            motivo = (
                f"Registra {_formatear_anios_a_texto(total)} de experiencia; "
                f"se requieren mínimo {_formatear_anios_a_texto(float(exp_min))}."
            )
            motivos.append(motivo)
            detalle["experiencia"] = {"cumple": False, "motivo": motivo}
        else:
            detalle["experiencia"] = {"cumple": True, "motivo": None}

    idioma_req = criterios.get("idioma_requerido")
    if idioma_req:
        # Puede haber varios registros del mismo idioma (p. ej. dos cursos): vale el mejor.
        coincidencias = [
            r for r in registros if r.get("tipo") == "idioma" and _texto_incluye_keyword(r.get("idioma"), idioma_req)
        ]
        nivel_min_texto = nivel_idioma_normalizado(criterios.get("idioma_nivel_min"))
        nivel_min_idioma = NIVEL_IDIOMA_ORDEN.get(nivel_min_texto, 0)
        # -1 (y no 0) cuando el idioma ni siquiera está registrado: así no "cumple"
        # por defecto un requisito sin nivel mínimo explícito.
        nivel_cand = max(
            (NIVEL_IDIOMA_ORDEN.get(nivel_idioma_de_registro(r), 0) for r in coincidencias), default=-1
        )
        cumple_idioma = nivel_cand >= nivel_min_idioma
        motivo = f'No cumple el nivel de {idioma_req} requerido (mínimo {nivel_min_texto or "cualquiera"} o superior).'
        if not cumple_idioma:
            motivos.append(motivo)
        _marcar_conocimientos(cumple_idioma, motivo)

    certificaciones_kw = criterios.get("certificaciones_keywords") or []
    for cert_kw in certificaciones_kw:

        def _coincide(r, kw=cert_kw):
            if r.get("tipo") == "certificacion":
                return _texto_incluye_keyword(r.get("nombreNorma"), kw)
            if r.get("tipo") == "educacionTrabajo":
                return _texto_incluye_keyword(r.get("nombreEvento"), kw)
            if r.get("tipo") == "estudio":
                return _texto_incluye_keyword(r.get("titulo"), kw)
            return False

        tiene_cert = any(_coincide(r) for r in registros)
        motivo = f'No se encontró certificación/curso relacionado con "{cert_kw}".'
        if not tiene_cert:
            motivos.append(motivo)
        _marcar_conocimientos(tiene_cert, motivo)

    return {"cumple": len(motivos) == 0, "motivos": motivos, "detalle": detalle}
