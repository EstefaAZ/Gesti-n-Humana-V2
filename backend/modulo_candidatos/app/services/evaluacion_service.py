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
    motivos: list[str] = []
    criterios = (vacante or {}).get("criterios") or {}
    dp = solicitud.get("datos_personales") or solicitud.get("datosPersonales") or {}
    registros = solicitud.get("registros_ii") or solicitud.get("registrosII") or []
    experiencia = solicitud.get("experiencia") or []

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
            motivos.append(f'No registra nivel educativo "{nivel_min}"{sufijo}.')

    profesion_kw = criterios.get("profesion_keyword")
    if profesion_kw:
        kw = profesion_kw.lower()
        match = any(
            r.get("tipo") == "estudio" and kw in (r.get("titulo") or "").lower() for r in registros
        ) or kw in (dp.get("profesion") or "").lower()
        if not match:
            motivos.append(f'Ningún título/profesión registrada incluye "{profesion_kw}".')

    exp_min = criterios.get("experiencia_min_anios")
    if exp_min:
        total = _total_experiencia_anios(experiencia)
        if total < float(exp_min):
            motivos.append(f"Registra {total:.1f} años de experiencia; se requieren mínimo {exp_min}.")

    idioma_req = criterios.get("idioma_requerido")
    if idioma_req:
        kw = idioma_req.lower()
        match = next((r for r in registros if r.get("tipo") == "idioma" and kw in (r.get("idioma") or "").lower()), None)
        nivel_min_idioma = NIVEL_IDIOMA_ORDEN.get(criterios.get("idioma_nivel_min", ""), 0)
        habilidad = criterios.get("idioma_habilidad", "habla")
        nivel_cand = NIVEL_IDIOMA_ORDEN.get(match.get(habilidad, ""), -1) if match else -1
        if nivel_cand < nivel_min_idioma:
            motivos.append(f'No cumple el nivel de {idioma_req} requerido ({habilidad}: {criterios.get("idioma_nivel_min")}).')

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

        if not any(_coincide(r) for r in registros):
            motivos.append(f'No se encontró certificación/curso relacionado con "{cert_kw}".')

    return {"cumple": len(motivos) == 0, "motivos": motivos}
