# ==============================================================
# modulo_candidatos / app/services/retencion_service.py
#
# Habeas data (Ley 1581 de 2012) — derechos de cancelación/supresión.
#
# ⚠️ EL VALOR DE RETENCIÓN POR DEFECTO ES UN PUNTO DE PARTIDA RAZONABLE,
# NO UNA DECISIÓN LEGAL VALIDADA. Legal/Gestión Humana debe confirmarlo
# antes de producción (ver RETENCION_MESES_NO_SELECCIONADOS en config.py).
# ==============================================================

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.solicitud import Solicitud

ESTADOS_QUE_NO_SE_ANONIMIZAN = {"Aceptada"}  # pasan a expediente laboral, con otras reglas de retención

CAMPOS_IDENTIFICATORIOS = [
    "nombreCompleto", "cedula", "cedulaDe", "correo", "celular", "telResidencia",
    "direccion", "fechaNacimiento",
]


class PermisoDenegadoError(Exception):
    pass


class SolicitudNoEncontradaError(Exception):
    pass


def _anonimizar_datos_personales(datos: dict) -> dict:
    anonimizado = dict(datos)
    for campo in CAMPOS_IDENTIFICATORIOS:
        if campo in anonimizado:
            anonimizado[campo] = "ANONIMIZADO"
    return anonimizado


def anonimizar_solicitudes_vencidas(db: Session) -> int:
    """
    Anonimiza (no elimina) las solicitudes de candidatos NO contratados cuya
    fecha de solicitud supera RETENCION_MESES_NO_SELECCIONADOS. Se conserva
    el estado, la evaluación y el historial para estadísticas del proceso,
    pero ya no se puede identificar a la persona.
    """
    limite = datetime.now(timezone.utc) - timedelta(days=30 * settings.RETENCION_MESES_NO_SELECCIONADOS)

    candidatas = (
        db.query(Solicitud)
        .filter(Solicitud.anonimizada.is_(False))
        .filter(~Solicitud.estado.in_(ESTADOS_QUE_NO_SE_ANONIMIZAN))
        .all()
    )

    procesadas = 0
    for s in candidatas:
        fecha = s.fecha_solicitud
        if fecha is None:
            continue
        if fecha.tzinfo is None:
            fecha = fecha.replace(tzinfo=timezone.utc)
        if fecha > limite:
            continue

        s.datos_personales = _anonimizar_datos_personales(s.datos_personales or {})
        if s.autorizacion and "nombreCompleto" in s.autorizacion:
            s.autorizacion = {**s.autorizacion, "nombreCompleto": "ANONIMIZADO"}
        s.anonimizada = True
        s.fecha_anonimizacion = datetime.now(timezone.utc)
        procesadas += 1

    if procesadas:
        db.commit()
    return procesadas


def eliminar_solicitud_propia(db: Session, radicado: str, usuario_id: str) -> None:
    """
    Derecho de supresión a pedido del propio candidato — elimina la fila
    por completo (no anonimiza). Restringido al dueño de la solicitud.
    """
    solicitud = db.query(Solicitud).filter(Solicitud.radicado == radicado).first()
    if not solicitud:
        raise SolicitudNoEncontradaError(f"No existe una solicitud con radicado {radicado}.")
    if solicitud.usuario_id != usuario_id:
        raise PermisoDenegadoError("Solo puedes eliminar tus propias solicitudes.")
    if solicitud.estado == "Aceptada":
        raise PermisoDenegadoError(
            "Esta solicitud ya pasó a ser parte de un expediente laboral; contacta directamente a "
            "Gestión Humana para gestionar la eliminación de esos datos."
        )
    db.delete(solicitud)
    db.commit()
