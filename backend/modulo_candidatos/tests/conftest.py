# ==============================================================
# modulo_candidatos / tests/conftest.py
#
# Un solo engine/TestClient compartido entre TODOS los archivos de
# prueba. Si cada archivo crea su propio engine en memoria y
# reasigna app.dependency_overrides[get_db], se pisan entre sí: la
# última reasignación (a nivel de import, no de test) queda activa
# para TODOS los tests de la sesión, sin importar qué archivo la puso.
# ==============================================================

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
