# ==============================================================
# modulo_candidatos / app/main.py
# ==============================================================

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings, validar_configuracion_produccion
from app.core.database import Base, engine
from app.api.v1.solicitudes import router as solicitudes_router

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
    logger.info("Módulo de Candidatos detenido correctamente")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Módulo de solicitudes de inscripción (GTH-FOR-03) — Aguas Nacionales EPM. "
        "Depende del módulo Login (JWT) y consulta al módulo Vacantes por HTTP."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(solicitudes_router, prefix="/api/v1")


@app.get("/", tags=["Sistema"])
def raiz():
    return {"modulo": settings.APP_NAME, "version": settings.APP_VERSION, "estado": "operativo", "docs": "/docs"}


@app.get("/health", tags=["Sistema"])
def health():
    return {"estado": "saludable"}
