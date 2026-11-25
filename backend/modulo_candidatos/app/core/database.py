# ==============================================================
# modulo_candidatos / app/core/database.py
# Motor y sesión de SQLAlchemy
# ==============================================================

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

# app/core/database.py -> app/core -> app -> raíz del módulo (junto a requirements.txt y .env)
_RAIZ_MODULO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _url_persistente(url: str) -> str:
    """
    Una URL sqlite con ruta relativa (`sqlite:///./archivo.db`) se resuelve
    contra el directorio de trabajo del PROCESO, no del proyecto. Si el
    servicio se arranca desde otra carpeta — otro método de arranque, un
    WORKDIR de contenedor distinto, un script de despliegue que hace cd a
    otro sitio — termina creando/leyendo un archivo .db distinto y vacío, y
    los datos "desaparecen" aunque el archivo original siga intacto donde
    siempre estuvo. Se ancla la ruta a la raíz del módulo para que sea
    siempre la misma sin importar desde dónde se arranque el proceso.
    """
    prefijo = "sqlite:///"
    if not url.startswith(prefijo) or url.startswith("sqlite:////"):
        return url  # no es sqlite, o ya es una ruta absoluta (sqlite:////...)
    ruta_absoluta = os.path.abspath(os.path.join(_RAIZ_MODULO, url[len(prefijo):]))
    return f"{prefijo}{ruta_absoluta}"


DATABASE_URL = _url_persistente(settings.DATABASE_URL)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Columnas agregadas después de crear la tabla: create_all() no altera tablas
# existentes, así que se agregan aquí si faltan (SQLite y PostgreSQL).
_COLUMNAS_NUEVAS = {
    "solicitudes": {"certificados_meta": "JSON"},
}


def agregar_columnas_faltantes() -> None:
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    with engine.begin() as conexion:
        for tabla, columnas in _COLUMNAS_NUEVAS.items():
            if not inspector.has_table(tabla):
                continue
            existentes = {c["name"] for c in inspector.get_columns(tabla)}
            for nombre, tipo in columnas.items():
                if nombre not in existentes:
                    conexion.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {nombre} {tipo}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
