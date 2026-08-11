# ==============================================================
# modulo_candidatos / app/api/v1/solicitudes.py
# ==============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import obtener_usuario_actual, requerir_roles, UsuarioToken, oauth2_scheme
from app.clients import vacantes_client
from app.clients.vacantes_client import VacantesServiceError
from app.schemas.solicitud import SolicitudCrear, SolicitudOut, CambiarEstado, EstadisticasSolicitudes, EventoAuditoriaOut, InscribirmeConPerfil
from app.services import solicitud_service, retencion_service, auditoria_service, email_service, notificacion_service, reporte_service
from app.services.pdf_service import generar_pdf_solicitud

router = APIRouter(prefix="/solicitudes", tags=["Solicitudes"])

ROLES_GESTION = ("gestor_humano", "admin")


def _solicitud_a_dict(solicitud) -> dict:
    return {
        "radicado": solicitud.radicado,
        "vacante_id": solicitud.vacante_id,
        "vacante_cargo": solicitud.vacante_cargo,
        "vacante_proceso_no": solicitud.vacante_proceso_no,
        "usuario_id": solicitud.usuario_id,
        "datos_personales": solicitud.datos_personales,
        "registros_ii": solicitud.registros_ii,
        "experiencia": solicitud.experiencia,
        "conflicto": solicitud.conflicto,
        "autorizacion": solicitud.autorizacion,
        "evaluacion": solicitud.evaluacion,
        "estado": solicitud.estado,
        "historial_estados": solicitud.historial_estados,
        "fecha_solicitud": solicitud.fecha_solicitud,
    }


def _verificar_acceso(solicitud, usuario: UsuarioToken):
    """El dueño de la solicitud o alguien de Gestión Humana pueden verla."""
    if solicitud.usuario_id != usuario.id and usuario.rol not in ROLES_GESTION:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a esta solicitud.")


@router.post("", response_model=SolicitudOut, status_code=status.HTTP_201_CREATED)
def crear_solicitud(
    datos: SolicitudCrear,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
    token: str = Depends(oauth2_scheme),
):
    try:
        solicitud = solicitud_service.crear_solicitud(db, datos, usuario_id=usuario.id, token=token)
    except solicitud_service.VacanteNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except solicitud_service.VacanteCerradaError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except solicitud_service.YaPostuladoError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except solicitud_service.PostulacionActivaError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except VacantesServiceError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo verificar la vacante en este momento. Intenta de nuevo en unos minutos.",
        )

    nombre_candidato = (solicitud.datos_personales or {}).get("nombreCompleto") or usuario.id
    auditoria_service.registrar_evento(
        db, tipo="solicitud_creada",
        descripcion=f"{nombre_candidato} envió una solicitud (radicado {solicitud.radicado}).",
        actor_id=usuario.id, actor_nombre=nombre_candidato, actor_rol=usuario.rol,
        entidad_tipo="solicitud", entidad_id=solicitud.radicado,
    )
    return solicitud


@router.post("/inscribirme", response_model=SolicitudOut, status_code=status.HTTP_201_CREATED)
def inscribirme_con_perfil(
    datos: InscribirmeConPerfil,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles("candidato")),
    token: str = Depends(oauth2_scheme),
):
    """Inscribirse con un clic — reutiliza el perfil ya guardado del candidato."""
    try:
        solicitud = solicitud_service.inscribirse_con_perfil(
            db, usuario_id=usuario.id, vacante_id=datos.vacante_id, token=token,
            documentos_extra=datos.documentos_extra,
        )
    except solicitud_service.PerfilIncompletoError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except solicitud_service.VacanteNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except solicitud_service.VacanteCerradaError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except solicitud_service.YaPostuladoError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except solicitud_service.PostulacionActivaError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except VacantesServiceError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo verificar la vacante en este momento. Intenta de nuevo en unos minutos.",
        )

    nombre_candidato = (solicitud.datos_personales or {}).get("nombreCompleto") or usuario.id
    auditoria_service.registrar_evento(
        db, tipo="solicitud_creada",
        descripcion=f"{nombre_candidato} se inscribió con su perfil guardado (radicado {solicitud.radicado}).",
        actor_id=usuario.id, actor_nombre=nombre_candidato, actor_rol=usuario.rol,
        entidad_tipo="solicitud", entidad_id=solicitud.radicado,
    )
    return solicitud


@router.get("/mias", response_model=list[SolicitudOut])
def mis_solicitudes(db: Session = Depends(get_db), usuario: UsuarioToken = Depends(obtener_usuario_actual)):
    return solicitud_service.listar_por_usuario(db, usuario.id)


@router.get("/vacante/{vacante_id}", response_model=list[SolicitudOut])
def postulaciones_de_vacante(
    vacante_id: str,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    """Panel de Gestión Humana: todas las postulaciones de una vacante."""
    return solicitud_service.listar_por_vacante(db, vacante_id)


@router.get("/admin/reporte/{vacante_id}")
def descargar_reporte_vacante(
    vacante_id: str,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
    token: str = Depends(oauth2_scheme),
):
    """Reporte GTH-FOR-03 (Base de Aspirantes) de una vacante, en Excel."""
    vacante = vacantes_client.obtener_vacante(vacante_id, token=token)
    if not vacante:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe una vacante con ese id.")

    solicitudes = solicitud_service.listar_por_vacante(db, vacante_id)
    contenido = reporte_service.generar_reporte_vacante(vacante, solicitudes)

    nombre_archivo = f"GTH-FOR-03_{vacante.get('proceso_no', vacante_id)}.xlsx".replace("/", "-")
    return Response(
        content=contenido,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )


@router.get("/{radicado}", response_model=SolicitudOut)
def obtener_solicitud(
    radicado: str,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
):
    solicitud = solicitud_service.obtener_por_radicado(db, radicado)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    _verificar_acceso(solicitud, usuario)
    return solicitud


@router.patch("/{radicado}/estado", response_model=SolicitudOut)
def cambiar_estado(
    radicado: str,
    datos: CambiarEstado,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
    token: str = Depends(oauth2_scheme),
):
    anterior = solicitud_service.obtener_por_radicado(db, radicado)
    estado_previo = anterior.estado if anterior else None
    try:
        actualizada = solicitud_service.actualizar_estado(db, radicado, datos.estado)
    except solicitud_service.SolicitudNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="estado_cambiado",
        descripcion=f"{usuario.nombre or usuario.id} cambió el estado de {radicado} de \"{estado_previo}\" a \"{datos.estado}\".",
        actor_id=usuario.id, actor_nombre=usuario.nombre, actor_rol=usuario.rol,
        entidad_tipo="solicitud", entidad_id=radicado,
    )

    dp = actualizada.datos_personales or {}
    nombre = dp.get("nombreCompleto") or "Candidato"
    correo = dp.get("correo")
    vacante = vacantes_client.obtener_vacante(actualizada.vacante_id, token=token)
    cargo = (vacante or {}).get("cargo") or "tu proceso de selección"

    notificacion_service.crear_notificacion_candidato(
        db, actualizada.usuario_id, tipo="estado_cambiado",
        titulo="Actualización de tu postulación",
        mensaje=f'Tu postulación a "{cargo}" (radicado {radicado}) cambió a "{datos.estado}".',
        entidad_tipo="solicitud", entidad_id=radicado,
    )
    if correo:
        email_service.enviar_correo_cambio_estado(correo, nombre, cargo, radicado, datos.estado)

    return actualizada


@router.patch("/{radicado}/retirar", response_model=SolicitudOut)
def retirar_mi_postulacion(
    radicado: str,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
):
    """El candidato se retira de un proceso — se conserva todo, solo cambia el estado a "Retirada"."""
    try:
        actualizada = solicitud_service.retirar_solicitud_propia(db, radicado, usuario.id)
    except solicitud_service.SolicitudNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except solicitud_service.PermisoDenegadoError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="solicitud_retirada",
        descripcion=f"{usuario.nombre or usuario.id} se retiró de la postulación {radicado}.",
        actor_id=usuario.id, actor_nombre=usuario.nombre, actor_rol=usuario.rol,
        entidad_tipo="solicitud", entidad_id=radicado,
    )
    notificacion_service.crear_notificacion_gestion(
        db, tipo="postulacion_retirada",
        titulo="Un candidato se retiró de un proceso",
        mensaje=f'{usuario.nombre or "Un candidato"} se retiró de la postulación {radicado} ("{actualizada.vacante_cargo or "vacante"}").',
        entidad_tipo="solicitud", entidad_id=radicado,
    )
    return actualizada


@router.get("/{radicado}/pdf")
def descargar_pdf(
    radicado: str,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
):
    solicitud = solicitud_service.obtener_por_radicado(db, radicado)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    _verificar_acceso(solicitud, usuario)

    pdf_bytes = generar_pdf_solicitud(_solicitud_a_dict(solicitud))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{radicado}.pdf"'},
    )


@router.get("/{radicado}/documentos/{categoria}/{indice}")
def descargar_documento_adjunto(
    radicado: str,
    categoria: str,
    indice: int,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
):
    """Descarga un documento adjunto específico (cédula, certificado, etc.).
    Mismo control de acceso que el PDF de la solicitud: dueño o Gestión Humana."""
    solicitud = solicitud_service.obtener_por_radicado(db, radicado)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    _verificar_acceso(solicitud, usuario)

    try:
        contenido, nombre = solicitud_service.obtener_documento(db, radicado, categoria, indice)
    except solicitud_service.DocumentoNoEncontradoError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return Response(
        content=contenido,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


# ---------------------------------------------------------------
# Habeas data (Ley 1581 de 2012) — derechos de cancelación/supresión
# ---------------------------------------------------------------

@router.delete("/{radicado}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_mi_solicitud(
    radicado: str,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(obtener_usuario_actual),
):
    """
    Derecho de supresión: el candidato elimina por completo su propia
    solicitud (no un borrado lógico). Solo el dueño puede hacerlo, y no
    aplica si ya fue aceptada (pasa a expediente laboral, con Gestión Humana).
    """
    try:
        retencion_service.eliminar_solicitud_propia(db, radicado, usuario.id)
    except retencion_service.SolicitudNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except retencion_service.PermisoDenegadoError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="solicitud_eliminada",
        descripcion=f"{usuario.nombre or usuario.id} eliminó su solicitud {radicado} (derecho de supresión).",
        actor_id=usuario.id, actor_nombre=usuario.nombre, actor_rol=usuario.rol,
        entidad_tipo="solicitud", entidad_id=radicado,
    )


@router.post("/admin/anonimizar-vencidas")
def anonimizar_vencidas(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    """
    Anonimiza las solicitudes de candidatos no contratados que ya superaron
    el período de retención configurado (RETENCION_MESES_NO_SELECCIONADOS).

    ⚠️ Hoy se dispara manualmente desde este endpoint. En producción debería
    ejecutarse solo (cron / Azure Function con timer trigger) — queda
    documentado como pendiente de infraestructura.
    """
    procesadas = retencion_service.anonimizar_solicitudes_vencidas(db)

    if procesadas:
        auditoria_service.registrar_evento(
            db, tipo="anonimizacion_ejecutada",
            descripcion=f"{usuario.nombre or usuario.id} ejecutó la anonimización: {procesadas} solicitud(es) procesada(s).",
            actor_id=usuario.id, actor_nombre=usuario.nombre, actor_rol=usuario.rol,
            entidad_tipo="solicitud", entidad_id=None,
        )
    return {"solicitudes_anonimizadas": procesadas}


@router.get("/admin/auditoria/eventos", response_model=list[EventoAuditoriaOut])
def auditoria(
    limite: int = 100,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles("admin")),
):
    """Registro de auditoría: quién hizo qué y cuándo en este módulo. Solo admin."""
    return auditoria_service.listar_eventos(db, limite=limite)


@router.get("/admin/conteo-por-vacante", response_model=dict[str, int])
def conteo_por_vacante(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    """Cuántas postulaciones tiene cada vacante — {vacante_id: total}. Para la tabla de Gestión Humana."""
    return solicitud_service.conteo_por_vacante(db)


@router.get("/admin/estadisticas", response_model=EstadisticasSolicitudes)
def estadisticas(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    """Conteos reales de postulaciones para el Dashboard."""
    return solicitud_service.obtener_estadisticas(db)
