# ==============================================================
# modulo_login / app/models/foto_perfil.py
# Foto de perfil de un usuario
# ==============================================================
#
# Va en su propia tabla (y no como columna de "usuarios") porque el proyecto
# no usa migraciones: Base.metadata.create_all() crea tablas nuevas al
# arrancar, pero NO agrega columnas a una tabla que ya existe. Así funciona
# igual en una base de datos nueva o en una que ya tiene usuarios.

from sqlalchemy import Column, String, DateTime, LargeBinary, ForeignKey
from sqlalchemy.sql import func

from app.core.database import Base


class FotoPerfil(Base):
    __tablename__ = "fotos_perfil"

    usuario_id = Column(String(36), ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    contenido = Column(LargeBinary, nullable=False)
    tipo = Column(String(30), nullable=False)  # image/jpeg, image/png o image/webp
    actualizada = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
