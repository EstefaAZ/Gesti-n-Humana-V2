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
from app.services import email_service, notificacion_service


class VacanteNoEncontradaError(Exception):
    pass


class VacanteCerradaError(Exception):
    pass


class YaPostuladoError(Exception):
    pass


class SolicitudNoEncontradaError(Exception):
    pass


class PerfilIncompletoError(Exception):
    pass


class PostulacionActivaError(Exception):
    """El candidato ya tiene una postulación en curso en otra vacante — no
    puede participar en dos procesos de selección a la vez (según el
    formato GTH-FOR-02: 'Una persona sólo puede inscribirse en un proceso
    de selección a la vez')."""
    pass


ESTADOS_VACANTE_EN_CURSO = ("publicada", "en_proceso")


def _tiene_postulacion_activa_en_otra_vacante(db: Session, usuario_id: str, token: Optional[str]) -> bool:
    """Revisa TODAS las solicitudes previas del candidato y consulta el estado
    ACTUAL de cada vacante asociada (puede haber cambiado desde que se postuló).
    Si alguna sigue "publicada" o "en_proceso", el candidato no puede postularse
    a una vacante nueva hasta que esa se cierre o se cancele."""
    solicitudes_previas = db.query(Solicitud).filter(Solicitud.usuario_id == usuario_id).all()
    for sol in solicitudes_previas:
        vacante = vacantes_client.obtener_vacante(sol.vacante_id, token=token)
        if vacante and vacante.get("estado") in ESTADOS_VACANTE_EN_CURSO:
            return True
    return False


def _validar_vacante_disponible(db: Session, vacante_id: str, usuario_id: str, token: Optional[str]) -> dict:
    vacante = vacantes_client.obtener_vacante(vacante_id, token=token)
    if not vacante:
        raise VacanteNoEncontradaError(f"No existe una vacante con id {vacante_id}.")
    if vacante.get("esta_cerrada"):
        raise VacanteCerradaError("Esta convocatoria ya cerró; no se aceptan más inscripciones.")
    if vacante.get("aun_no_abre"):
        raise VacanteCerradaError(f"Esta convocatoria abre el {vacante.get('fecha_apertura')}; todavía no se reciben inscripciones.")

    ya_existe = (
        db.query(Solicitud)
        .filter(Solicitud.vacante_id == vacante_id, Solicitud.usuario_id == usuario_id)
        .first()
    )
    if ya_existe:
        raise YaPostuladoError("Ya existe una solicitud tuya para esta vacante.")

    if _tiene_postulacion_activa_en_otra_vacante(db, usuario_id, token):
        raise PostulacionActivaError(
            "Ya tienes una postulación en curso en otro proceso de selección. Solo puedes participar en uno a la "
            "vez — espera a que se cierre o se cancele para poder inscribirte a una vacante nueva."
        )
    return vacante


def _guardar_solicitud(
    db: Session, vacante: dict, vacante_id: str, usuario_id: str,
    datos_personales: dict, registros_ii: list, experiencia: list, conflicto: dict,
    autorizacion: dict, documentos_adjuntos: dict,
) -> Solicitud:
    evaluacion = evaluar_postulacion(
        {"datos_personales": datos_personales, "registros_ii": registros_ii, "experiencia": experiencia},
        vacante,
    )
    ahora = datetime.now(timezone.utc).isoformat()
    solicitud = Solicitud(
        radicado=_generar_radicado(),
        vacante_id=vacante_id,
        usuario_id=usuario_id,
        datos_personales=datos_personales,
        registros_ii=registros_ii,
        experiencia=experiencia,
        conflicto=conflicto,
        autorizacion=autorizacion,
        documentos_adjuntos=documentos_adjuntos,
        evaluacion=evaluacion,
        estado="Recibida",
        historial_estados=[{"estado": "Recibida", "fecha": ahora}],
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)

    nombre = datos_personales.get("nombreCompleto") or "Candidato"
    cargo = vacante.get("cargo") or "la vacante"
    correo = datos_personales.get("correo")

    notificacion_service.crear_notificacion_candidato(
        db, usuario_id, tipo="solicitud_creada",
        titulo="Recibimos tu inscripción",
        mensaje=f'Tu inscripción a "{cargo}" fue recibida (radicado {solicitud.radicado}).',
        entidad_tipo="solicitud", entidad_id=solicitud.radicado,
    )
    if correo:
        email_service.enviar_correo_solicitud_recibida(correo, nombre, cargo, solicitud.radicado)

    notificacion_service.crear_notificacion_gestion(
        db, tipo="nueva_postulacion",
        titulo="Nueva postulación recibida",
        mensaje=f'{nombre} se postuló a "{cargo}" (radicado {solicitud.radicado}).',
        entidad_tipo="solicitud", entidad_id=solicitud.radicado,
    )

    return solicitud


def crear_solicitud(db: Session, datos: SolicitudCrear, usuario_id: str, token: Optional[str] = None) -> Solicitud:
    vacante = _validar_vacante_disponible(db, datos.vacante_id, usuario_id, token)
    return _guardar_solicitud(
        db, vacante, datos.vacante_id, usuario_id,
        datos.datos_personales, datos.registros_ii, datos.experiencia, datos.conflicto,
        datos.autorizacion, datos.documentos_adjuntos.model_dump(),
    )


MAXIMOS_DOCUMENTOS = {"cedula": 1, "certificados_laborales": 10, "certificados_estudio": 10, "tarjeta_profesional": 3}


def _combinar_documentos(documentos_perfil: dict, documentos_extra) -> dict:
    """Documentos del perfil + los que el candidato adjunte extra para ESTA vacante en particular,
    respetando los mismos máximos por categoría."""
    combinados = {cat: list(documentos_perfil.get(cat, [])) for cat in MAXIMOS_DOCUMENTOS}
    if documentos_extra:
        extra_dict = documentos_extra.model_dump()
        for categoria, maximo in MAXIMOS_DOCUMENTOS.items():
            espacio = maximo - len(combinados[categoria])
            if espacio > 0:
                combinados[categoria].extend(extra_dict.get(categoria, [])[:espacio])
    return combinados


def inscribirse_con_perfil(
    db: Session, usuario_id: str, vacante_id: str, token: Optional[str] = None, documentos_extra=None,
) -> Solicitud:
    """
    Inscribirse con un clic: reutiliza el perfil ya guardado del candidato en
    vez de pedirle llenar el formulario de nuevo. `documentos_extra` son
    certificaciones adicionales SOLO para esta vacante (no se guardan en el
    perfil, solo en esta solicitud puntual).
    """
    from app.services import perfil_candidato_service

    perfil = perfil_candidato_service.obtener_perfil(db, usuario_id)
    if not perfil or not perfil.completado:
        raise PerfilIncompletoError("Debes completar tu perfil antes de poder inscribirte a una vacante.")

    vacante = _validar_vacante_disponible(db, vacante_id, usuario_id, token)
    documentos_combinados = _combinar_documentos(perfil.documentos_adjuntos or {}, documentos_extra)

    # El perfil guarda autorizacion.nombre_completo (snake_case, viene del esquema
    # Pydantic AutorizacionPerfil). El resto del sistema — Hoja VIII, PDF, panel de
    # Gestión Humana — siempre ha usado nombreCompleto (camelCase). Sin este ajuste,
    # las solicitudes creadas por este camino guardaban la llave distinta y la
    # sección "Autorización" se veía vacía en el panel de Gestión Humana.
    autorizacion_normalizada = {
        "acepta": (perfil.autorizacion or {}).get("acepta", False),
        "nombreCompleto": (perfil.autorizacion or {}).get("nombre_completo", ""),
    }

    return _guardar_solicitud(
        db, vacante, vacante_id, usuario_id,
        perfil.datos_personales, perfil.registros_ii, perfil.experiencia, perfil.conflicto,
        autorizacion_normalizada, documentos_combinados,
    )


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
