# ==============================================================
# modulo_login / app/schemas/usuario.py
# Esquemas Pydantic — validación de entrada/salida
# ==============================================================

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.usuario import RolUsuario


def _validar_politica_password(v: str) -> str:
    """
    Misma política que el checklist visual del frontend (Registro/Cambiar
    contraseña/Restablecer contraseña): mínimo 8 caracteres (ya lo exige
    Field(min_length=8) en cada esquema), una mayúscula, una minúscula, un
    número y un carácter especial. Se valida también aquí — y no solo en el
    frontend — para que nadie pueda saltarse la política llamando a la API
    directamente sin pasar por el sitio.
    """
    faltantes = []
    if not any(c.isdigit() for c in v):
        faltantes.append("un número")
    if not any(c.isupper() for c in v):
        faltantes.append("una mayúscula")
    if not any(c.islower() for c in v):
        faltantes.append("una minúscula")
    if not any(not c.isalnum() for c in v):
        faltantes.append("un carácter especial")
    if faltantes:
        raise ValueError(f"La contraseña debe incluir al menos: {', '.join(faltantes)}.")
    return v


class UsuarioRegistro(BaseModel):
    """
    Registro PÚBLICO — lo usa cualquier persona desde el sitio.
    A propósito NO tiene un campo `rol`: todo registro público es candidato,
    sin excepción. No hay manera de que alguien se autoasigne otro rol aquí.
    """
    nombre_completo: str = Field(min_length=3, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    cedula: Optional[str] = None

    model_config = {"extra": "ignore"}  # ignora cualquier campo extra (p.ej. "rol") en vez de fallar o aceptarlo

    @field_validator("password")
    @classmethod
    def password_valida(cls, v: str) -> str:
        return _validar_politica_password(v)


class UsuarioCrearInterno(BaseModel):
    """
    Creación de cuentas INTERNAS (gestor_humano / admin).
    Solo se usa desde el endpoint protegido que exige rol admin.
    """
    nombre_completo: str = Field(min_length=3, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    rol: RolUsuario = RolUsuario.gestor_humano

    @field_validator("password")
    @classmethod
    def password_valida(cls, v: str) -> str:
        return _validar_politica_password(v)

    @field_validator("rol")
    @classmethod
    def rol_no_puede_ser_candidato(cls, v: RolUsuario) -> RolUsuario:
        # Para candidatos existe el registro público; este endpoint es solo para roles internos.
        if v == RolUsuario.candidato:
            raise ValueError("Usa el registro público para crear cuentas de candidato.")
        return v


class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str
    recordar: bool = False  # si es True, el token dura semanas en vez de horas


class SolicitarResetPassword(BaseModel):
    email: EmailStr


class ConfirmarResetPassword(BaseModel):
    token: str
    password_nueva: str = Field(min_length=8, max_length=100)

    @field_validator("password_nueva")
    @classmethod
    def password_valida(cls, v: str) -> str:
        return _validar_politica_password(v)


class UsuarioOut(BaseModel):
    id: str
    nombre_completo: str
    email: EmailStr
    rol: RolUsuario
    cedula: Optional[str] = None
    activo: bool
    fecha_creacion: Optional[datetime] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class CambiarPassword(BaseModel):
    """Cambio de contraseña propio — exige la contraseña actual para confirmar identidad."""
    password_actual: str
    password_nueva: str = Field(min_length=8, max_length=100)

    @field_validator("password_nueva")
    @classmethod
    def password_valida(cls, v: str) -> str:
        return _validar_politica_password(v)


class ActualizarPerfil(BaseModel):
    """Edición del propio perfil. Todos los campos son opcionales (se actualiza solo lo enviado)."""
    nombre_completo: Optional[str] = Field(default=None, min_length=3, max_length=200)
    email: Optional[EmailStr] = None


class EditarUsuario(BaseModel):
    """
    Un admin edita cualquier dato administrable de OTRO usuario. Ambos campos
    son opcionales — se actualiza solo lo que venga. Reemplaza al antiguo
    CambiarRol (que solo aceptaba rol) para no tener dos endpoints casi
    idénticos en la página de Usuarios.
    """
    nombre_completo: Optional[str] = Field(default=None, min_length=3, max_length=200)
    rol: Optional[RolUsuario] = None


class EstadisticasUsuarios(BaseModel):
    total: int
    por_rol: dict[str, int]
    recientes: list[UsuarioOut]


class EventoAuditoriaOut(BaseModel):
    id: str
    tipo: str
    descripcion: str
    actor_nombre: Optional[str] = None
    actor_rol: Optional[str] = None
    entidad_tipo: Optional[str] = None
    entidad_id: Optional[str] = None
    fecha: Optional[datetime] = None

    model_config = {"from_attributes": True}
