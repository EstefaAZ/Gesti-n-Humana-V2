# ==============================================================
# modulo_login / app/services/auth_service.py
# Lógica de negocio de autenticación
# ==============================================================

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password, crear_access_token
from app.models.usuario import Usuario, RolUsuario
from app.schemas.usuario import UsuarioRegistro, UsuarioCrearInterno, ActualizarPerfil, EditarUsuario


class EmailYaRegistradoError(Exception):
    pass


class CedulaYaRegistradaError(Exception):
    pass


class CredencialesInvalidasError(Exception):
    pass


class UsuarioInactivoError(Exception):
    pass


class UsuarioNoEncontradoError(Exception):
    pass


class TokenResetInvalidoError(Exception):
    pass


def registrar_usuario(db: Session, datos: UsuarioRegistro) -> Usuario:
    """Registro público. SIEMPRE crea un candidato — no hay forma de pasar otro rol aquí."""
    if db.query(Usuario).filter(Usuario.email == datos.email).first():
        raise EmailYaRegistradoError(f"El correo {datos.email} ya está registrado.")

    if datos.cedula and db.query(Usuario).filter(Usuario.cedula == datos.cedula).first():
        raise CedulaYaRegistradaError(f"La cédula {datos.cedula} ya está registrada.")

    usuario = Usuario(
        nombre_completo=datos.nombre_completo,
        email=datos.email,
        password_hash=hash_password(datos.password),
        rol=RolUsuario.candidato,
        cedula=datos.cedula,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def crear_usuario_interno(db: Session, datos: UsuarioCrearInterno) -> Usuario:
    """
    Crea una cuenta con rol gestor_humano o admin.
    Solo se debe llamar desde una ruta protegida con requerir_roles(RolUsuario.admin).
    """
    if db.query(Usuario).filter(Usuario.email == datos.email).first():
        raise EmailYaRegistradoError(f"El correo {datos.email} ya está registrado.")

    usuario = Usuario(
        nombre_completo=datos.nombre_completo,
        email=datos.email,
        password_hash=hash_password(datos.password),
        rol=datos.rol,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def autenticar_usuario(db: Session, email: str, password: str) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario or not verify_password(password, usuario.password_hash):
        raise CredencialesInvalidasError("Correo o contraseña incorrectos.")
    if not usuario.activo:
        raise UsuarioInactivoError("Este usuario está inactivo. Contacta a un administrador.")
    return usuario


def generar_token_para_usuario(usuario: Usuario, recordar: bool = False) -> str:
    expira = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES_RECORDAR if recordar else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return crear_access_token(
        data={
            "sub": usuario.id,
            "rol": usuario.rol.value,
            "email": usuario.email,
            "nombre": usuario.nombre_completo,
        },
        expires_delta=expira,
    )


def solicitar_reset_password(db: Session, email: str) -> tuple[Usuario, str] | tuple[None, None]:
    """
    Genera un token de restablecimiento si el correo existe. Devuelve
    (None, None) si no existe una cuenta con ese correo — la ruta HTTP
    responde igual en ambos casos (mismo mensaje genérico), para no revelar
    si un correo está registrado o no.
    """
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        return None, None

    token = secrets.token_urlsafe(32)
    usuario.reset_token = token
    usuario.reset_token_expira = datetime.now(timezone.utc) + timedelta(
        minutes=settings.RESET_PASSWORD_TOKEN_EXPIRE_MINUTES
    )
    db.commit()
    return usuario, token


def confirmar_reset_password(db: Session, token: str, password_nueva: str) -> None:
    usuario = db.query(Usuario).filter(Usuario.reset_token == token).first()
    if not usuario:
        raise TokenResetInvalidoError("El enlace no es válido. Solicita uno nuevo.")

    expira = usuario.reset_token_expira
    if expira and expira.tzinfo is None:
        expira = expira.replace(tzinfo=timezone.utc)
    if not expira or datetime.now(timezone.utc) > expira:
        raise TokenResetInvalidoError("El enlace expiró. Solicita uno nuevo.")

    usuario.password_hash = hash_password(password_nueva)
    usuario.reset_token = None
    usuario.reset_token_expira = None
    db.commit()


class UltimoAdminError(Exception):
    pass


def _otros_admins_activos(db: Session, usuario_id: str) -> int:
    return (
        db.query(Usuario)
        .filter(Usuario.rol == RolUsuario.admin, Usuario.id != usuario_id, Usuario.activo.is_(True))
        .count()
    )


def eliminar_cuenta_propia(db: Session, usuario: Usuario) -> None:
    """
    Derecho de supresión (Ley 1581 de 2012): el usuario elimina su propia
    cuenta por completo. Si es el único admin activo, se rechaza para no
    dejar el sistema sin nadie que pueda crear cuentas gestor_humano/admin.
    """
    if usuario.rol == RolUsuario.admin and _otros_admins_activos(db, usuario.id) == 0:
        raise UltimoAdminError(
            "No puedes eliminar tu cuenta: eres el único admin activo. Crea otro admin antes de eliminar esta cuenta."
        )
    db.delete(usuario)
    db.commit()


def desactivar_cuenta_propia(db: Session, usuario: Usuario) -> None:
    """
    Igual que eliminar_cuenta_propia, pero reversible: marca activo=False en
    vez de borrar la fila. El login ya rechaza usuarios inactivos (ver
    autenticar_usuario). Un admin puede reactivarla con reactivar_cuenta().
    Misma protección que eliminar: no se puede dejar el sistema sin ningún
    admin activo.
    """
    if usuario.rol == RolUsuario.admin and _otros_admins_activos(db, usuario.id) == 0:
        raise UltimoAdminError(
            "No puedes desactivar tu cuenta: eres el único admin activo. Crea otro admin antes de desactivar esta cuenta."
        )
    usuario.activo = False
    db.commit()


def reactivar_cuenta(db: Session, usuario_id: str) -> Usuario:
    """Un admin reactiva la cuenta de OTRO usuario (rol gestor_humano/admin lo llama desde una ruta protegida)."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise UsuarioNoEncontradoError(f"No existe un usuario con id {usuario_id}.")
    usuario.activo = True
    db.commit()
    db.refresh(usuario)
    return usuario


def desactivar_cuenta_de_otro(db: Session, usuario_id: str) -> Usuario:
    """
    Un admin desactiva la cuenta de OTRO usuario (ej. un candidato lo pide por
    otro medio — correo, teléfono). Misma protección que desactivar_cuenta_propia:
    no se puede dejar el sistema sin ningún admin activo.
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise UsuarioNoEncontradoError(f"No existe un usuario con id {usuario_id}.")
    if usuario.rol == RolUsuario.admin and _otros_admins_activos(db, usuario.id) == 0:
        raise UltimoAdminError(
            "No puedes desactivar esta cuenta: es el único admin activo. Crea otro admin antes de desactivarla."
        )
    usuario.activo = False
    db.commit()
    db.refresh(usuario)
    return usuario


def cambiar_password_propia(db: Session, usuario: Usuario, password_actual: str, password_nueva: str) -> None:
    if not verify_password(password_actual, usuario.password_hash):
        raise CredencialesInvalidasError("La contraseña actual no es correcta.")
    usuario.password_hash = hash_password(password_nueva)
    db.commit()


def actualizar_perfil_propio(db: Session, usuario: Usuario, datos: ActualizarPerfil) -> Usuario:
    if datos.email and datos.email != usuario.email:
        if db.query(Usuario).filter(Usuario.email == datos.email, Usuario.id != usuario.id).first():
            raise EmailYaRegistradoError(f"El correo {datos.email} ya está registrado.")
        usuario.email = datos.email
    if datos.nombre_completo:
        usuario.nombre_completo = datos.nombre_completo
    db.commit()
    db.refresh(usuario)
    return usuario


def listar_usuarios(db: Session) -> list[Usuario]:
    """Solo para el panel de administración (requiere rol admin en la ruta)."""
    return db.query(Usuario).order_by(Usuario.fecha_creacion.desc()).all()


def listar_candidatos(db: Session) -> list[Usuario]:
    """
    Solo cuentas rol=candidato — a diferencia de listar_usuarios() (admin-only,
    ve TODAS las cuentas incluidas las de Gestión Humana/admin), esta es la que
    usa la página "Candidatos" y SÍ puede verla gestor_humano, porque nunca
    expone cuentas internas del sistema, solo candidatos reales.
    """
    return (
        db.query(Usuario)
        .filter(Usuario.rol == RolUsuario.candidato)
        .order_by(Usuario.fecha_creacion.desc())
        .all()
    )


def obtener_estadisticas(db: Session) -> dict:
    """Conteos reales para el Dashboard — nada de cifras de ejemplo."""
    total = db.query(Usuario).count()
    por_rol = {
        rol.value: db.query(Usuario).filter(Usuario.rol == rol).count()
        for rol in RolUsuario
    }
    recientes = db.query(Usuario).order_by(Usuario.fecha_creacion.desc()).limit(5).all()
    return {"total": total, "por_rol": por_rol, "recientes": recientes}


def editar_usuario(db: Session, usuario_objetivo_id: str, datos: EditarUsuario) -> Usuario:
    """
    Un admin edita el nombre y/o el rol de OTRO usuario. Solo se debe llamar
    desde una ruta protegida con requerir_roles(RolUsuario.admin). Si se le
    quita el rol admin al último admin activo, se rechaza — igual que al
    eliminar la cuenta, para no dejar el sistema sin ningún admin.
    """
    objetivo = db.query(Usuario).filter(Usuario.id == usuario_objetivo_id).first()
    if not objetivo:
        raise UsuarioNoEncontradoError(f"No existe un usuario con id {usuario_objetivo_id}.")

    if datos.rol is not None and objetivo.rol == RolUsuario.admin and datos.rol != RolUsuario.admin:
        if _otros_admins_activos(db, objetivo.id) == 0:
            raise UltimoAdminError(
                "No puedes quitarle el rol admin: es el único admin activo. Crea otro admin primero."
            )

    if datos.nombre_completo is not None:
        objetivo.nombre_completo = datos.nombre_completo
    if datos.rol is not None:
        objetivo.rol = datos.rol

    db.commit()
    db.refresh(objetivo)
    return objetivo
