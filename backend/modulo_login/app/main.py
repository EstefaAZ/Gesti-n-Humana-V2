# ==============================================================
# modulo_login / app/main.py
# Punto de entrada - Módulo de Autenticación
# ==============================================================

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings, validar_configuracion_produccion
from app.core.database import Base, engine
from app.api.v1.auth import router as auth_router, limiter
from app.api.v1.notificaciones import router as notificaciones_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validar_configuracion_produccion()
    logger.info(f"Iniciando {settings.APP_NAME} v{settings.APP_VERSION} (ENVIRONMENT={settings.ENVIRONMENT})")
    Base.metadata.create_all(bind=engine)
    yield
    logger.info("Módulo de Login detenido correctamente")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Módulo de autenticación — Plataforma de Selección Aguas Nacionales EPM. "
        "RF-01: Registro de usuarios. RF-02: Inicio de sesión (JWT). "
        "RF-03: Perfil del usuario autenticado. RN-01: Roles candidato / gestor_humano / admin."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(notificaciones_router, prefix="/api/v1")


@app.get("/", tags=["Sistema"])
def raiz():
    return {
        "modulo": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "estado": "operativo",
        "docs": "/docs",
    }


@app.get("/health", tags=["Sistema"])
def health():
    """Health check para load balancer y Docker."""
    return {"estado": "saludable"}
