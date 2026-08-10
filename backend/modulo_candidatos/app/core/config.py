# ==============================================================
# modulo_candidatos / app/core/config.py
# ==============================================================

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # "development" | "production" — controla validaciones de arranque más estrictas
    ENVIRONMENT: str = "development"

    APP_NAME: str = "Módulo Candidatos — Aguas Nacionales EPM"
    APP_VERSION: str = "1.0.0"

    DATABASE_URL: str = "sqlite:///./candidatos_dev.db"

    # Debe coincidir con el módulo Login: este servicio solo valida el JWT.
    SECRET_KEY: str = "CAMBIAR-ESTA-CLAVE-EN-PRODUCCION"
    ALGORITHM: str = "HS256"

    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # URL base del módulo Vacantes — se consulta por HTTP para traer la vacante
    # y sus criterios de evaluación (cada módulo tiene su propia base de datos).
    VACANTES_SERVICE_URL: str = "http://localhost:8001"

    # Habeas data (Ley 1581 de 2012): meses tras los cuales se anonimiza
    # automáticamente la solicitud de un candidato NO contratado.
    # ⚠️ VALOR DE PARTIDA — Legal/Gestión Humana debe confirmarlo antes de producción.
    RETENCION_MESES_NO_SELECCIONADOS: int = 6

    # Correo (SMTP) — igual que en modulo_login: si SMTP_HOST queda vacío, los
    # correos se registran en el log en vez de enviarse (modo desarrollo).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-responder@aguasnacionalesepm.com"
    SMTP_USE_TLS: bool = True
    FRONTEND_URL: str = "http://localhost:5173"

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
