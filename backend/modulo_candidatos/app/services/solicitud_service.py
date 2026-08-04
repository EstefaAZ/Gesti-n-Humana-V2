# ==============================================================
# modulo_candidatos / app/services/solicitud_service.py
# ==============================================================

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.clients import vacantes_client
from app.models.solicitud import Solicitud, _generar_radicado
from app.schemas.solicitud import SolicitudCrear
from app.services.evaluacion_service import evaluar_postulacion


class VacanteNoEncontradaError(Exception):
    pass


class VacanteCerradaError(Exception):
    pass


class YaPostuladoError(Exception):
    pass


class SolicitudNoEncontradaError(Exception):
    pass


def crear_solicitud(db: Session, datos: SolicitudCrear, usuario_id: str, token: Optional[str] = None) -> Solicitud:
    vacante = vacantes_client.obtener_vacante(datos.vacante_id, token=token)
    if not vacante:
        raise VacanteNoEncontradaError(f"No existe una vacante con id {datos.vacante_id}.")
    if vacante.get("esta_cerrada"):
        raise VacanteCerradaError("Esta convocatoria ya cerró; no se aceptan más inscripciones.")

    ya_existe = (
        db.query(Solicitud)
        .filter(Solicitud.vacante_id == datos.vacante_id, Solicitud.usuario_id == usuario_id)
        .first()
    )
    if ya_existe:
        raise YaPostuladoError("Ya existe una solicitud tuya para esta vacante.")

    solicitud_dict = {
        "datos_personales": datos.datos_personales,
        "registros_ii": datos.registros_ii,
        "experiencia": datos.experiencia,
    }
    evaluacion = evaluar_postulacion(solicitud_dict, vacante)

    ahora = datetime.now(timezone.utc).isoformat()
    solicitud = Solicitud(
        radicado=_generar_radicado(),
        vacante_id=datos.vacante_id,
        usuario_id=usuario_id,
        datos_personales=datos.datos_personales,
        registros_ii=datos.registros_ii,
        experiencia=datos.experiencia,
        conflicto=datos.conflicto,
        autorizacion=datos.autorizacion,
        documentos_adjuntos=datos.documentos_adjuntos.model_dump(),
        evaluacion=evaluacion,
        estado="Recibida",
        historial_estados=[{"estado": "Recibida", "fecha": ahora}],
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    return solicitud


def listar_por_usuario(db: Session, usuario_id: str) -> list[Solicitud]:
    return (
        db.query(Solicitud)
        .filter(Solicitud.usuario_id == usuario_id)
        .order_by(Solicitud.fecha_solicitud.desc())
        .all()
    )


def listar_por_vacante(db: Session, vacante_id: str) -> list[Solicitud]:
    return (
        db.query(Solicitud)
        .filter(Solicitud.vacante_id == vacante_id)
        .order_by(Solicitud.fecha_solicitud.desc())
        .all()
    )


def obtener_por_radicado(db: Session, radicado: str) -> Optional[Solicitud]:
    return db.query(Solicitud).filter(Solicitud.radicado == radicado).first()


def _obtener_o_falla(db: Session, radicado: str) -> Solicitud:
    solicitud = obtener_por_radicado(db, radicado)
    if not solicitud:
        raise SolicitudNoEncontradaError(f"No existe una solicitud con radicado {radicado}.")
    return solicitud


class DocumentoNoEncontradoError(Exception):
    pass


CATEGORIAS_DOCUMENTOS = ("cedula", "certificados_laborales", "certificados_estudio", "tarjeta_profesional")


def obtener_documento(db: Session, radicado: str, categoria: str, indice: int) -> tuple[bytes, str]:
    import base64

    solicitud = _obtener_o_falla(db, radicado)
    if categoria not in CATEGORIAS_DOCUMENTOS:
        raise DocumentoNoEncontradoError(f"Categoría de documento inválida: {categoria}.")

    lista = (solicitud.documentos_adjuntos or {}).get(categoria, [])
    if indice < 0 or indice >= len(lista):
        raise DocumentoNoEncontradoError("No existe un documento con ese índice en esa categoría.")

    doc = lista[indice]
    try:
        contenido = base64.b64decode(doc["contenido_base64"])
    except Exception:
        raise DocumentoNoEncontradoError("El documento está corrupto y no se pudo leer.")
    return contenido, doc.get("nombre", f"{categoria}-{indice}.pdf")


def actualizar_estado(db: Session, radicado: str, nuevo_estado: str) -> Solicitud:
    solicitud = _obtener_o_falla(db, radicado)
    solicitud.estado = nuevo_estado
    historial = list(solicitud.historial_estados or [])
    historial.append({"estado": nuevo_estado, "fecha": datetime.now(timezone.utc).isoformat()})
    solicitud.historial_estados = historial
    db.commit()
    db.refresh(solicitud)
    return solicitud


def conteo_por_vacante(db: Session) -> dict[str, int]:
    """Cuántas postulaciones tiene cada vacante — para la tabla de Gestión Humana."""
    conteo: dict[str, int] = {}
    for (vacante_id,) in db.query(Solicitud.vacante_id).all():
        conteo[vacante_id] = conteo.get(vacante_id, 0) + 1
    return conteo


def obtener_estadisticas(db: Session) -> dict:
    """Conteos reales para el Dashboard: total, por estado, por mes (últimos 6) y recientes."""
    todas = db.query(Solicitud).all()

    por_estado: dict[str, int] = {}
    for s in todas:
        por_estado[s.estado] = por_estado.get(s.estado, 0) + 1

    # Últimos 6 meses, en orden cronológico, incluidos los meses sin postulaciones (en 0)
    ahora = datetime.now(timezone.utc)
    meses_orden = []
    cursor = ahora.replace(day=1)
    for _ in range(6):
        meses_orden.append(cursor.strftime("%Y-%m"))
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    meses_orden.reverse()

    conteo_por_mes = {m: 0 for m in meses_orden}
    for s in todas:
        if not s.fecha_solicitud:
            continue
        fecha = s.fecha_solicitud
        if fecha.tzinfo is None:
            fecha = fecha.replace(tzinfo=timezone.utc)
        clave = fecha.strftime("%Y-%m")
        if clave in conteo_por_mes:
            conteo_por_mes[clave] += 1

    recientes = sorted(todas, key=lambda s: s.fecha_solicitud or datetime.min, reverse=True)[:5]
    recientes_out = [
        {
            "radicado": s.radicado,
            "vacante_id": s.vacante_id,
            "nombre_completo": (s.datos_personales or {}).get("nombreCompleto"),
            "estado": s.estado,
            "fecha_solicitud": s.fecha_solicitud,
        }
        for s in recientes
    ]

    return {
        "total": len(todas),
        "por_estado": por_estado,
        "por_mes": [{"mes": m, "total": conteo_por_mes[m]} for m in meses_orden],
        "recientes": recientes_out,
    }
