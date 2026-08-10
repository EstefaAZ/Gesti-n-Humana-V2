# ==============================================================
# modulo_login / app/core/config.py
# Configuración central del módulo — variables de entorno
# ==============================================================

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Módulo Login — Aguas Nacionales EPM"
    APP_VERSION: str = "1.0.0"

    # "development" | "production" — controla validaciones de arranque más estrictas
    ENVIRONMENT: str = "development"

    # Base de datos (PostgreSQL en producción; ver README para SQLite en dev)
    DATABASE_URL: str = "sqlite:///./login_dev.db"

    # Seguridad / JWT
    SECRET_KEY: str = "CAMBIAR-ESTA-CLAVE-EN-PRODUCCION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 horas
    ACCESS_TOKEN_EXPIRE_MINUTES_RECORDAR: int = 60 * 24 * 30  # 30 días — cuando el usuario marca "Recordarme"
    RESET_PASSWORD_TOKEN_EXPIRE_MINUTES: int = 30

    # Correo (SMTP) — si SMTP_HOST queda vacío, los correos NO se envían de
    # verdad: se registran en el log del servidor (modo desarrollo), útil para
    # probar el flujo completo sin credenciales reales.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-responder@aguasnacionalesepm.com"
    SMTP_USE_TLS: bool = True
    FRONTEND_URL: str = "http://localhost:5173"  # para armar enlaces dentro de los correos

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

PLACEHOLDER_SECRET_KEY = "CAMBIAR-ESTA-CLAVE-EN-PRODUCCION"


def validar_configuracion_produccion() -> None:
    """
    Se llama al arrancar la app. Si ENVIRONMENT=production y la configuración
    todavía tiene valores de ejemplo, el servicio se niega a arrancar en vez
    de quedar expuesto silenciosamente con una clave conocida públicamente.
    """
    if settings.ENVIRONMENT != "production":
        return

    errores = []
    if settings.SECRET_KEY == PLACEHOLDER_SECRET_KEY:
        errores.append(
            "SECRET_KEY sigue siendo el valor de ejemplo. Genera uno real con: "
            "python3 -c \"import secrets; print(secrets.token_hex(32))\""
        )
    if "*" in settings.ALLOWED_ORIGINS:
        errores.append("ALLOWED_ORIGINS no debe contener '*' en producción.")
    if "localhost" in settings.ALLOWED_ORIGINS or "127.0.0.1" in settings.ALLOWED_ORIGINS:
        errores.append("ALLOWED_ORIGINS contiene 'localhost' — configúralo con el dominio real de producción.")

    if errores:
        mensaje = "Configuración insegura para ENVIRONMENT=production:\n- " + "\n- ".join(errores)
        raise RuntimeError(mensaje)
