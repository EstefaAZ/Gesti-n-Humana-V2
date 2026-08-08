# ==============================================================
# modulo_login / app/api/v1/auth.py
# Rutas — RF-01 Registro | RF-02 Login | RF-03 Perfil
# ==============================================================

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import obtener_usuario_actual, requerir_roles
from app.models.usuario import Usuario, RolUsuario
from app.schemas.usuario import (
    UsuarioRegistro, UsuarioLogin, UsuarioOut, Token, UsuarioCrearInterno,
    CambiarPassword, ActualizarPerfil, EditarUsuario,
    SolicitarResetPassword, ConfirmarResetPassword, EstadisticasUsuarios, EventoAuditoriaOut,
)
from app.services import auth_service, auditoria_service

router = APIRouter(prefix="/auth", tags=["Autenticación"])
limiter = Limiter(key_func=get_remote_address)

# Límites pensados para uso humano normal, pero que frenan fuerza bruta:
# un candidato real no necesita más de unos pocos intentos por minuto.
LIMITE_LOGIN = "10/minute"
LIMITE_REGISTRO = "5/minute"
LIMITE_OLVIDE_PASSWORD = "5/minute"


@router.post("/registro", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(LIMITE_REGISTRO)
def registro(request: Request, datos: UsuarioRegistro, db: Session = Depends(get_db)):
    """Registro público. Siempre crea un usuario con rol candidato."""
    try:
        usuario = auth_service.registrar_usuario(db, datos)
    except auth_service.EmailYaRegistradoError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except auth_service.CedulaYaRegistradaError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="usuario_registrado",
        descripcion=f"{usuario.nombre_completo} ({usuario.email}) se registró como candidato.",
        actor_id=usuario.id, actor_nombre=usuario.nombre_completo, actor_rol="candidato",
        entidad_tipo="usuario", entidad_id=usuario.id,
    )
    return usuario


@router.post("/usuarios-internos", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear_usuario_interno(
    datos: UsuarioCrearInterno,
    db: Session = Depends(get_db),
    admin_actual: Usuario = Depends(requerir_roles(RolUsuario.admin)),
):
    """
    Crea una cuenta gestor_humano o admin. SOLO un admin ya existente puede
    llamar esto — es la única forma de que alguien obtenga esos roles.
    """
    try:
        usuario = auth_service.crear_usuario_interno(db, datos)
    except auth_service.EmailYaRegistradoError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="usuario_creado_interno",
        descripcion=f"{admin_actual.nombre_completo} creó la cuenta {usuario.nombre_completo} ({usuario.rol.value}).",
        actor_id=admin_actual.id, actor_nombre=admin_actual.nombre_completo, actor_rol=admin_actual.rol.value,
        entidad_tipo="usuario", entidad_id=usuario.id,
    )
    return usuario


@router.post("/login", response_model=Token)
@limiter.limit(LIMITE_LOGIN)
def login(request: Request, datos: UsuarioLogin, db: Session = Depends(get_db)):
    try:
        usuario = auth_service.autenticar_usuario(db, datos.email, datos.password)
    except auth_service.CredencialesInvalidasError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except auth_service.UsuarioInactivoError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    token = auth_service.generar_token_para_usuario(usuario, recordar=datos.recordar)
    return Token(access_token=token, usuario=UsuarioOut.model_validate(usuario))


@router.post("/olvide-password")
@limiter.limit(LIMITE_OLVIDE_PASSWORD)
def olvide_password(request: Request, datos: SolicitarResetPassword, db: Session = Depends(get_db)):
    """
    Solicitar restablecimiento de contraseña. Responde con el MISMO mensaje
    exista o no una cuenta con ese correo, para no revelar qué correos están
    registrados.

    ⚠️ Todavía no hay envío de correos real (eso vive en el futuro módulo de
    Notificaciones). Mientras tanto, en ENVIRONMENT=development esta ruta
    devuelve el enlace directamente en la respuesta para poder probar el
    flujo completo. En producción ese campo simplemente no viaja — hay que
    conectar un envío de correo real antes de lanzar esto a producción.
    """
    usuario, token = auth_service.solicitar_reset_password(db, datos.email)

    respuesta = {"mensaje": "Si el correo está registrado, se enviará un enlace para restablecer la contraseña."}
    if settings.ENVIRONMENT != "production" and usuario:
        respuesta["token_dev"] = token
        respuesta["aviso_dev"] = "Este campo solo aparece en desarrollo — en producción se envía por correo."
    return respuesta


@router.post("/restablecer-password", status_code=status.HTTP_204_NO_CONTENT)
def restablecer_password(datos: ConfirmarResetPassword, db: Session = Depends(get_db)):
    try:
        auth_service.confirmar_reset_password(db, datos.token, datos.password_nueva)
    except auth_service.TokenResetInvalidoError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/me", response_model=UsuarioOut)
def perfil(usuario: Usuario = Depends(obtener_usuario_actual)):
    return usuario


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cuenta_propia(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obtener_usuario_actual),
):
    """Derecho de supresión: elimina por completo la cuenta del usuario autenticado."""
    nombre_previo, rol_previo, id_previo = usuario.nombre_completo, usuario.rol.value, usuario.id
    try:
        auth_service.eliminar_cuenta_propia(db, usuario)
    except auth_service.UltimoAdminError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="cuenta_eliminada",
        descripcion=f"{nombre_previo} eliminó su propia cuenta ({rol_previo}).",
        actor_id=id_previo, actor_nombre=nombre_previo, actor_rol=rol_previo,
        entidad_tipo="usuario", entidad_id=id_previo,
    )


@router.patch("/me/desactivar", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_cuenta_propia(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obtener_usuario_actual),
):
    """
    Igual que eliminar, pero reversible: la cuenta queda inactiva (no puede
    volver a iniciar sesión) hasta que un admin la reactive con
    PATCH /usuarios/{id}/activar. No borra ningún dato.
    """
    nombre_previo, rol_previo, id_previo = usuario.nombre_completo, usuario.rol.value, usuario.id
    try:
        auth_service.desactivar_cuenta_propia(db, usuario)
    except auth_service.UltimoAdminError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="cuenta_desactivada",
        descripcion=f"{nombre_previo} desactivó su propia cuenta ({rol_previo}).",
        actor_id=id_previo, actor_nombre=nombre_previo, actor_rol=rol_previo,
        entidad_tipo="usuario", entidad_id=id_previo,
    )


@router.patch("/usuarios/{usuario_id}/activar", response_model=UsuarioOut)
def reactivar_cuenta(
    usuario_id: str,
    db: Session = Depends(get_db),
    admin_actual: Usuario = Depends(requerir_roles(RolUsuario.admin)),
):
    """Un admin reactiva una cuenta que se había desactivado (propia o ajena, ej. tras desactivarse por error)."""
    try:
        reactivada = auth_service.reactivar_cuenta(db, usuario_id)
    except auth_service.UsuarioNoEncontradoError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    auditoria_service.registrar_evento(
        db, tipo="cuenta_reactivada",
        descripcion=f"{admin_actual.nombre_completo} reactivó la cuenta de {reactivada.nombre_completo}.",
        actor_id=admin_actual.id, actor_nombre=admin_actual.nombre_completo, actor_rol=admin_actual.rol.value,
        entidad_tipo="usuario", entidad_id=reactivada.id,
    )
    return reactivada


@router.patch("/me", response_model=UsuarioOut)
def actualizar_mi_perfil(
    datos: ActualizarPerfil,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obtener_usuario_actual),
):
    """Edita el propio nombre y/o correo. Los campos no enviados quedan igual."""
    try:
        return auth_service.actualizar_perfil_propio(db, usuario, datos)
    except auth_service.EmailYaRegistradoError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_mi_password(
    datos: CambiarPassword,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obtener_usuario_actual),
):
    """Cambia la propia contraseña. Exige la contraseña actual para confirmar identidad."""
    try:
        auth_service.cambiar_password_propia(db, usuario, datos.password_actual, datos.password_nueva)
    except auth_service.CredencialesInvalidasError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(
    db: Session = Depends(get_db),
    admin_actual: Usuario = Depends(requerir_roles(RolUsuario.admin)),
):
    """Panel de administración: lista todos los usuarios (para saber a quién cambiarle el rol)."""
    return auth_service.listar_usuarios(db)


@router.get("/estadisticas", response_model=EstadisticasUsuarios)
def estadisticas(
    db: Session = Depends(get_db),
    admin_actual: Usuario = Depends(requerir_roles(RolUsuario.admin)),
):
    """Conteos reales de usuarios para el Dashboard del admin."""
    return auth_service.obtener_estadisticas(db)


@router.patch("/usuarios/{usuario_id}", response_model=UsuarioOut)
def editar_usuario(
    usuario_id: str,
    datos: EditarUsuario,
    db: Session = Depends(get_db),
    admin_actual: Usuario = Depends(requerir_roles(RolUsuario.admin)),
):
    """Edita el nombre y/o el rol de OTRO usuario. Solo un admin puede hacerlo."""
    try:
        actualizado = auth_service.editar_usuario(db, usuario_id, datos)
    except auth_service.UsuarioNoEncontradoError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except auth_service.UltimoAdminError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    cambios = []
    if datos.nombre_completo is not None:
        cambios.append(f'el nombre a "{actualizado.nombre_completo}"')
    if datos.rol is not None:
        cambios.append(f'el rol a "{actualizado.rol.value}"')
    descripcion = f"{admin_actual.nombre_completo} editó a {actualizado.nombre_completo}: cambió {' y '.join(cambios)}." if cambios else ""

    if descripcion:
        auditoria_service.registrar_evento(
            db, tipo="usuario_editado",
            descripcion=descripcion,
            actor_id=admin_actual.id, actor_nombre=admin_actual.nombre_completo, actor_rol=admin_actual.rol.value,
            entidad_tipo="usuario", entidad_id=actualizado.id,
        )
    return actualizado


@router.get("/auditoria", response_model=list[EventoAuditoriaOut])
def auditoria(
    limite: int = 100,
    db: Session = Depends(get_db),
    admin_actual: Usuario = Depends(requerir_roles(RolUsuario.admin)),
):
    """Registro de auditoría: quién hizo qué y cuándo en este módulo."""
    return auditoria_service.listar_eventos(db, limite=limite)
