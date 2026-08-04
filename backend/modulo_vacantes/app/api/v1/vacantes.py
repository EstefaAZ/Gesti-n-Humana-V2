# ==============================================================
# modulo_vacantes / app/api/v1/vacantes.py
# Rutas — públicas (candidato) y protegidas (Gestión Humana)
# ==============================================================

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import requerir_roles, UsuarioToken
from app.schemas.vacante import (
    VacanteCrear, VacanteActualizar, VacanteOut, EstadisticasVacantes,
    EventoAuditoriaOut, CambiarEstadoVacante,
)
from app.models.vacante import ESTADOS_VISIBLES_CANDIDATO
from app.services import vacante_service, auditoria_service

router = APIRouter(prefix="/vacantes", tags=["Vacantes"])

ROLES_GESTION = ("gestor_humano", "admin")


# ---------------------------------------------------------------
# Rutas públicas — las usa el candidato, sin autenticación
# ---------------------------------------------------------------

@router.get("", response_model=list[VacanteOut])
def listar_vacantes_publicas(db: Session = Depends(get_db)):
    """Solo vacantes activas — lo que ve un candidato navegando el sitio."""
    return vacante_service.listar_vacantes(db, solo_visibles=True)


@router.get("/{vacante_id}", response_model=VacanteOut)
def obtener_vacante_publica(vacante_id: str, db: Session = Depends(get_db)):
    vacante = vacante_service.obtener_vacante(db, vacante_id)
    if not vacante or vacante.estado not in ESTADOS_VISIBLES_CANDIDATO:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vacante no encontrada.")
    return vacante


# ---------------------------------------------------------------
# Rutas protegidas — solo Gestión Humana / admin
# ---------------------------------------------------------------

@router.get("/admin/todas", response_model=list[VacanteOut])
def listar_todas_admin(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    """Incluye vacantes ocultas — panel de Gestión Humana."""
    return vacante_service.listar_vacantes(db, solo_visibles=False)


@router.get("/admin/estadisticas", response_model=EstadisticasVacantes)
def estadisticas(
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    """Conteos reales para el Dashboard. IMPORTANTE: esta ruta va antes de
    /admin/{vacante_id} en el archivo, si no, esa ruta dinámica la intercepta."""
    return vacante_service.obtener_estadisticas(db)


@router.get("/admin/{vacante_id}", response_model=VacanteOut)
def obtener_vacante_admin(
    vacante_id: str,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    vacante = vacante_service.obtener_vacante(db, vacante_id)
    if not vacante:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vacante no encontrada.")
    return vacante


@router.post("", response_model=VacanteOut, status_code=status.HTTP_201_CREATED)
def crear_vacante(
    datos: VacanteCrear,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    creada = vacante_service.crear_vacante(db, datos, usuario_id=usuario.id, usuario_nombre=usuario.nombre or "")
    auditoria_service.registrar_evento(
        db, tipo="vacante_creada",
        descripcion=f"{usuario.nombre or usuario.id} creó la vacante \"{creada.cargo}\" (proceso {creada.proceso_no}).",
        actor_id=usuario.id, actor_nombre=usuario.nombre, actor_rol=usuario.rol,
        entidad_tipo="vacante", entidad_id=creada.id,
    )
    return creada


@router.put("/{vacante_id}", response_model=VacanteOut)
def actualizar_vacante(
    vacante_id: str,
    datos: VacanteActualizar,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    try:
        actualizada = vacante_service.actualizar_vacante(db, vacante_id, datos)
    except vacante_service.VacanteNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="vacante_actualizada",
        descripcion=f"{usuario.nombre or usuario.id} editó la vacante \"{actualizada.cargo}\" (proceso {actualizada.proceso_no}).",
        actor_id=usuario.id, actor_nombre=usuario.nombre, actor_rol=usuario.rol,
        entidad_tipo="vacante", entidad_id=actualizada.id,
    )
    return actualizada


@router.patch("/{vacante_id}/estado", response_model=VacanteOut)
def cambiar_estado(
    vacante_id: str,
    datos: CambiarEstadoVacante,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    try:
        actualizada = vacante_service.cambiar_estado(db, vacante_id, datos.estado)
    except vacante_service.VacanteNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="vacante_cambio_estado",
        descripcion=f"{usuario.nombre or usuario.id} cambió el estado de \"{actualizada.cargo}\" a \"{datos.estado}\".",
        actor_id=usuario.id, actor_nombre=usuario.nombre, actor_rol=usuario.rol,
        entidad_tipo="vacante", entidad_id=actualizada.id,
    )
    return actualizada


@router.post("/{vacante_id}/documento", response_model=VacanteOut)
async def subir_documento(
    vacante_id: str,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    """Sube el formato oficial de la convocatoria (PDF) — lo que el candidato puede ver/descargar."""
    if archivo.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo debe ser un PDF.")
    contenido = await archivo.read()
    if len(contenido) > 10 * 1024 * 1024:  # 10 MB
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El PDF no puede pesar más de 10 MB.")

    try:
        actualizada = vacante_service.subir_documento_pdf(db, vacante_id, contenido, archivo.filename or "convocatoria.pdf")
    except vacante_service.VacanteNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="vacante_documento_subido",
        descripcion=f"{usuario.nombre or usuario.id} subió el formato PDF de \"{actualizada.cargo}\".",
        actor_id=usuario.id, actor_nombre=usuario.nombre, actor_rol=usuario.rol,
        entidad_tipo="vacante", entidad_id=actualizada.id,
    )
    return actualizada


@router.get("/{vacante_id}/documento")
def descargar_documento(vacante_id: str, db: Session = Depends(get_db)):
    """Público: cualquiera puede ver el PDF de una vacante visible (misma regla que verla)."""
    vacante = vacante_service.obtener_vacante(db, vacante_id)
    if not vacante or vacante.estado not in ESTADOS_VISIBLES_CANDIDATO:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vacante no encontrada.")
    try:
        contenido, nombre = vacante_service.obtener_documento_pdf(db, vacante_id)
    except vacante_service.DocumentoNoEncontradoError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{nombre}"'},
    )


@router.delete("/{vacante_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_vacante(
    vacante_id: str,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles(*ROLES_GESTION)),
):
    vacante = vacante_service.obtener_vacante(db, vacante_id)
    try:
        vacante_service.eliminar_vacante(db, vacante_id)
    except vacante_service.VacanteNoEncontradaError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="vacante_eliminada",
        descripcion=f"{usuario.nombre or usuario.id} eliminó la vacante \"{vacante.cargo if vacante else vacante_id}\".",
        actor_id=usuario.id, actor_nombre=usuario.nombre, actor_rol=usuario.rol,
        entidad_tipo="vacante", entidad_id=vacante_id,
    )


@router.get("/admin/auditoria/eventos", response_model=list[EventoAuditoriaOut])
def auditoria(
    limite: int = 100,
    db: Session = Depends(get_db),
    usuario: UsuarioToken = Depends(requerir_roles("admin")),
):
    """Registro de auditoría: quién hizo qué y cuándo en este módulo. Solo admin."""
    return auditoria_service.listar_eventos(db, limite=limite)
