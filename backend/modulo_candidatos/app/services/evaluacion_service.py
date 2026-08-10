# ==============================================================
# modulo_candidatos / app/services/evaluacion_service.py
#
# Evaluación automática — SOLO INFORMATIVA.
# Nunca bloquea el envío de una solicitud; únicamente le da a Gestión Humana
# una etiqueta ("Cumple" / "No cumple") con los motivos, para priorizar la
# revisión. La decisión final siempre la toma una persona.
# ==============================================================

from datetime import date, datetime
from typing import Any

NIVEL_EDUCATIVO_ORDEN = {"": 0, "Secundarios": 1, "Técnico": 2, "Tecnólogo": 3, "Universitario": 4, "Postgrado": 5}
NIVEL_IDIOMA_ORDEN = {"": 0, "Regular": 1, "Bien": 2, "Muy bien": 3}


def _parsear_fecha(valor) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(str(valor)[:10])
    except ValueError:
        return None


def _anios_entre_fechas(inicio_str, fin_str) -> float:
    inicio = _parsear_fecha(inicio_str)
    if inicio is None:
        return 0.0
    fin = _parsear_fecha(fin_str) or datetime.now()
    if fin < inicio:
        return 0.0
    return (fin - inicio).days / 365.25


def _total_experiencia_anios(experiencia: list[dict[str, Any]]) -> float:
    total = 0.0
    for e in experiencia:
        fin = None if e.get("actual") else e.get("fechaTerminacion")
        total += _anios_entre_fechas(e.get("fechaInicio"), fin)
    return total


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

    nivel_min = criterios.get("nivel_educativo_min")
    if nivel_min:
        graduado_requerido = criterios.get("graduado_requerido", True)
        max_nivel = 0
        for r in registros:
            if r.get("tipo") == "estudio":
                graduado_ok = (not graduado_requerido) or r.get("graduado") == "si"
                nivel = NIVEL_EDUCATIVO_ORDEN.get(r.get("nivelEducativo", ""), 0)
                if graduado_ok and nivel > max_nivel:
                    max_nivel = nivel
        if max_nivel < NIVEL_EDUCATIVO_ORDEN.get(nivel_min, 0):
            sufijo = " con graduación confirmada" if graduado_requerido else ""
            motivo = f'No registra nivel educativo "{nivel_min}"{sufijo}.'
            motivos.append(motivo)
            detalle["estudios"] = {"cumple": False, "motivo": motivo}
        else:
            detalle["estudios"] = {"cumple": True, "motivo": None}

    def _marcar_conocimientos(cumple: bool, motivo: str):
        actual = detalle["conocimientos"]
        # Si ya había un "no cumple" registrado, uno que sí cumple no lo revierte —
        # basta con que UN criterio de conocimientos falle para marcar la categoría en NO.
        if actual["cumple"] is False:
            return
        detalle["conocimientos"] = {"cumple": cumple, "motivo": None if cumple else motivo}

    profesion_kw = criterios.get("profesion_keyword")
    if profesion_kw:
        kw = profesion_kw.lower()
        match = any(
            r.get("tipo") == "estudio" and kw in (r.get("titulo") or "").lower() for r in registros
        ) or kw in (dp.get("profesion") or "").lower()
        if not match:
            motivo = f'Ningún título/profesión registrada incluye "{profesion_kw}".'
            motivos.append(motivo)
        _marcar_conocimientos(match, motivo if not match else "")

    exp_min = criterios.get("experiencia_min_anios")
    if exp_min:
        total = _total_experiencia_anios(experiencia)
        cumple_exp = total >= float(exp_min)
        if not cumple_exp:
            motivo = f"Registra {total:.1f} años de experiencia; se requieren mínimo {exp_min}."
            motivos.append(motivo)
            detalle["experiencia"] = {"cumple": False, "motivo": motivo}
        else:
            detalle["experiencia"] = {"cumple": True, "motivo": None}

    idioma_req = criterios.get("idioma_requerido")
    if idioma_req:
        kw = idioma_req.lower()
        match = next((r for r in registros if r.get("tipo") == "idioma" and kw in (r.get("idioma") or "").lower()), None)
        nivel_min_idioma = NIVEL_IDIOMA_ORDEN.get(criterios.get("idioma_nivel_min", ""), 0)
        habilidad = criterios.get("idioma_habilidad", "habla")
        nivel_cand = NIVEL_IDIOMA_ORDEN.get(match.get(habilidad, ""), -1) if match else -1
        cumple_idioma = nivel_cand >= nivel_min_idioma
        motivo = f'No cumple el nivel de {idioma_req} requerido ({habilidad}: {criterios.get("idioma_nivel_min")}).'
        if not cumple_idioma:
            motivos.append(motivo)
        _marcar_conocimientos(cumple_idioma, motivo)

    certificaciones_kw = criterios.get("certificaciones_keywords") or []
    for cert_kw in certificaciones_kw:
        kw = cert_kw.lower()

        def _coincide(r, kw=kw):
            if r.get("tipo") == "certificacion":
                return kw in (r.get("nombreNorma") or "").lower()
            if r.get("tipo") == "educacionTrabajo":
                return kw in (r.get("nombreEvento") or "").lower()
            if r.get("tipo") == "estudio":
                return kw in (r.get("titulo") or "").lower()
            return False

        tiene_cert = any(_coincide(r) for r in registros)
        motivo = f'No se encontró certificación/curso relacionado con "{cert_kw}".'
        if not tiene_cert:
            motivos.append(motivo)
        _marcar_conocimientos(tiene_cert, motivo)

    return {"cumple": len(motivos) == 0, "motivos": motivos, "detalle": detalle}
