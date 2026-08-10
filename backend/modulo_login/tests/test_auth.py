# ==============================================================
# modulo_login / tests/test_auth.py
# Pruebas del flujo de registro, login y perfil
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
from app.api.v1.auth import limiter as auth_limiter

# Base de datos SQLite en memoria, compartida en una sola conexión (StaticPool)
# para que todas las sesiones de la prueba vean las mismas tablas y datos.
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


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    auth_limiter.reset()  # cada prueba empieza con el contador de rate limit en cero
    yield
    Base.metadata.drop_all(bind=engine)


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

USUARIO_VALIDO = {
    "nombre_completo": "Estefanía Delgado Bernal",
    "email": "estefania@example.com",
    "password": "ClaveSegura123!",
    "cedula": "1000644999",
}


def test_health_check():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["estado"] == "saludable"


def test_registro_exitoso():
    r = client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    assert r.status_code == 201
    data = r.json()
    assert data["email"] == USUARIO_VALIDO["email"]
    assert data["rol"] == "candidato"
    assert "password" not in data
    assert "password_hash" not in data


def test_registro_rechaza_email_duplicado():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r = client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    assert r.status_code == 409


def test_registro_rechaza_password_sin_numero():
    datos = {**USUARIO_VALIDO, "email": "otro@example.com", "password": "SoloLetras"}
    r = client.post("/api/v1/auth/registro", json=datos)
    assert r.status_code == 422


def test_registro_rechaza_password_sin_mayuscula():
    datos = {**USUARIO_VALIDO, "email": "sinmayus@example.com", "password": "clavesegura123!"}
    r = client.post("/api/v1/auth/registro", json=datos)
    assert r.status_code == 422
    assert "mayúscula" in r.json()["detail"][0]["msg"]


def test_registro_rechaza_password_sin_minuscula():
    datos = {**USUARIO_VALIDO, "email": "sinminus@example.com", "password": "CLAVESEGURA123!"}
    r = client.post("/api/v1/auth/registro", json=datos)
    assert r.status_code == 422
    assert "minúscula" in r.json()["detail"][0]["msg"]


def test_registro_rechaza_password_sin_caracter_especial():
    datos = {**USUARIO_VALIDO, "email": "sinespecial@example.com", "password": "ClaveSegura123"}
    r = client.post("/api/v1/auth/registro", json=datos)
    assert r.status_code == 422
    assert "carácter especial" in r.json()["detail"][0]["msg"]


def test_registro_acepta_password_que_cumple_toda_la_politica():
    datos = {**USUARIO_VALIDO, "email": "cumpletodo@example.com", "password": "ClaveSegura123!"}
    r = client.post("/api/v1/auth/registro", json=datos)
    assert r.status_code == 201


def test_login_exitoso_y_token_valido():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["usuario"]["email"] == USUARIO_VALIDO["email"]

    # El token debe servir para consultar el perfil
    token = data["access_token"]
    r2 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["email"] == USUARIO_VALIDO["email"]


def test_token_incluye_claims_para_otros_modulos():
    # Otros módulos (Vacantes, Reportes...) validan el JWT sin volver a
    # consultar la base de usuarios, así que el token debe traer email y nombre.
    import jwt as jwt_lib
    from app.core.config import settings

    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    token = r.json()["access_token"]
    payload = jwt_lib.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["email"] == USUARIO_VALIDO["email"]
    assert payload["nombre"] == USUARIO_VALIDO["nombre_completo"]
    assert payload["rol"] == "candidato"


def test_login_rechaza_password_incorrecta():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": "Incorrecta123"})
    assert r.status_code == 401


def test_registro_ignora_intento_de_autoasignarse_rol_admin():
    # Alguien intenta registrarse pidiendo rol admin — el esquema público
    # no tiene ese campo, así que debe crearse como candidato sin importar
    # qué se envíe en el cuerpo de la petición.
    datos = {**USUARIO_VALIDO, "rol": "admin"}
    r = client.post("/api/v1/auth/registro", json=datos)
    assert r.status_code == 201
    assert r.json()["rol"] == "candidato"


def _token_de(email, password):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return r.json()["access_token"]


def test_crear_usuario_interno_sin_token_es_rechazado():
    r = client.post("/api/v1/auth/usuarios-internos", json={
        "nombre_completo": "Gestora Uno", "email": "gestora@example.com", "password": "ClaveSegura123!",
    })
    assert r.status_code == 401


def test_crear_usuario_interno_con_rol_candidato_es_rechazado():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    r = client.post(
        "/api/v1/auth/usuarios-internos",
        json={"nombre_completo": "Gestora Uno", "email": "gestora@example.com", "password": "ClaveSegura123!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403


def test_crear_usuario_interno_con_rol_admin_exitoso():
    # Sembramos un admin directamente (como haría scripts/crear_admin.py) para probar el flujo.
    from app.core.security import hash_password
    from app.models.usuario import Usuario, RolUsuario as R

    db = TestingSessionLocal()
    admin = Usuario(nombre_completo="Admin Semilla", email="admin@example.com",
                     password_hash=hash_password("ClaveAdmin123"), rol=R.admin)
    db.add(admin)
    db.commit()
    db.close()

    token = _token_de("admin@example.com", "ClaveAdmin123")
    r = client.post(
        "/api/v1/auth/usuarios-internos",
        json={"nombre_completo": "Gestora Uno", "email": "gestora@example.com", "password": "ClaveSegura123!", "rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
    assert r.json()["rol"] == "gestor_humano"


def test_crear_usuario_interno_rechaza_rol_candidato():
    from app.core.security import hash_password
    from app.models.usuario import Usuario, RolUsuario as R

    db = TestingSessionLocal()
    admin = Usuario(nombre_completo="Admin Semilla", email="admin2@example.com",
                     password_hash=hash_password("ClaveAdmin123"), rol=R.admin)
    db.add(admin)
    db.commit()
    db.close()

    token = _token_de("admin2@example.com", "ClaveAdmin123")
    r = client.post(
        "/api/v1/auth/usuarios-internos",
        json={"nombre_completo": "X", "email": "x@example.com", "password": "ClaveSegura123!", "rol": "candidato"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422


def test_me_sin_token_es_rechazado():
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_usuario_puede_eliminar_su_propia_cuenta():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    r = client.delete("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 204

    # La cuenta ya no existe: el mismo token no debe servir para nada
    r_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 401

    # Y el correo queda libre para volver a registrarse
    r_registro_de_nuevo = client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    assert r_registro_de_nuevo.status_code == 201


def test_ultimo_admin_no_puede_eliminar_su_propia_cuenta():
    from app.core.security import hash_password
    from app.models.usuario import Usuario, RolUsuario as R

    db = TestingSessionLocal()
    admin = Usuario(nombre_completo="Único Admin", email="unico-admin@example.com",
                     password_hash=hash_password("ClaveAdmin123"), rol=R.admin)
    db.add(admin)
    db.commit()
    db.close()

    token = _token_de("unico-admin@example.com", "ClaveAdmin123")
    r = client.delete("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 409


def test_admin_si_puede_eliminarse_cuando_hay_otro_admin_activo():
    from app.core.security import hash_password
    from app.models.usuario import Usuario, RolUsuario as R

    db = TestingSessionLocal()
    admin1 = Usuario(nombre_completo="Admin Uno", email="admin1@example.com",
                      password_hash=hash_password("ClaveAdmin123"), rol=R.admin)
    admin2 = Usuario(nombre_completo="Admin Dos", email="admin2@example.com",
                      password_hash=hash_password("ClaveAdmin123"), rol=R.admin)
    db.add_all([admin1, admin2])
    db.commit()
    db.close()

    token = _token_de("admin1@example.com", "ClaveAdmin123")
    r = client.delete("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 204


def test_desactivar_cuenta_propia_impide_volver_a_iniciar_sesion():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])

    r = client.patch("/api/v1/auth/me/desactivar", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 204

    # A diferencia de eliminar, los datos siguen ahí — pero no puede volver a entrar.
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    assert r_login.status_code == 403


def test_desactivar_cuenta_no_borra_los_datos_a_diferencia_de_eliminar():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    client.patch("/api/v1/auth/me/desactivar", headers={"Authorization": f"Bearer {token}"})

    # El correo debe seguir "ocupado" — a diferencia de eliminar, no queda libre para registrarse de nuevo.
    r_registro_de_nuevo = client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    assert r_registro_de_nuevo.status_code == 409


def test_ultimo_admin_no_puede_desactivar_su_propia_cuenta():
    from app.core.security import hash_password
    from app.models.usuario import Usuario, RolUsuario as R

    db = TestingSessionLocal()
    unico = Usuario(nombre_completo="Único Admin Desact", email="unico-desact@example.com",
                     password_hash=hash_password("ClaveAdmin123"), rol=R.admin)
    db.add(unico)
    db.commit()
    db.close()

    token = _token_de("unico-desact@example.com", "ClaveAdmin123")
    r = client.patch("/api/v1/auth/me/desactivar", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 409


def test_admin_puede_reactivar_una_cuenta_desactivada():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_candidato = r_login.json()["access_token"]
    client.patch("/api/v1/auth/me/desactivar", headers={"Authorization": f"Bearer {token_candidato}"})

    token_admin = _crear_admin()
    r_reactivar = client.patch(f"/api/v1/auth/usuarios/{candidato_id}/activar", headers={"Authorization": f"Bearer {token_admin}"})
    assert r_reactivar.status_code == 200
    assert r_reactivar.json()["activo"] is True

    # Ahora sí puede volver a iniciar sesión.
    r_login_de_nuevo = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    assert r_login_de_nuevo.status_code == 200


def test_admin_puede_desactivar_la_cuenta_de_otro_usuario():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]

    token_admin = _crear_admin()
    r = client.patch(f"/api/v1/auth/usuarios/{candidato_id}/desactivar", headers={"Authorization": f"Bearer {token_admin}"})
    assert r.status_code == 200
    assert r.json()["activo"] is False

    # No puede volver a iniciar sesión mientras esté desactivada.
    r_login_de_nuevo = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    assert r_login_de_nuevo.status_code == 403


def test_desactivar_cuenta_de_otro_requiere_rol_admin():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_candidato = r_login.json()["access_token"]

    r = client.patch(f"/api/v1/auth/usuarios/{candidato_id}/desactivar", headers={"Authorization": f"Bearer {token_candidato}"})
    assert r.status_code == 403


def test_desactivar_cuenta_de_otro_usuario_inexistente_da_404():
    token_admin = _crear_admin()
    r = client.patch("/api/v1/auth/usuarios/no-existe/desactivar", headers={"Authorization": f"Bearer {token_admin}"})
    assert r.status_code == 404


def test_no_se_puede_desactivar_al_unico_admin_activo():
    token_admin = _crear_admin()
    admin_id = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_admin}"}).json()["id"]
    r = client.patch(f"/api/v1/auth/usuarios/{admin_id}/desactivar", headers={"Authorization": f"Bearer {token_admin}"})
    assert r.status_code == 409


def test_auditoria_registra_desactivacion_de_otro_por_admin():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]

    token_admin = _crear_admin()
    client.patch(f"/api/v1/auth/usuarios/{candidato_id}/desactivar", headers={"Authorization": f"Bearer {token_admin}"})

    r_auditoria = client.get("/api/v1/auth/auditoria", headers={"Authorization": f"Bearer {token_admin}"})
    eventos = [e for e in r_auditoria.json() if e["tipo"] == "cuenta_desactivada"]
    assert len(eventos) == 1
    assert USUARIO_VALIDO["nombre_completo"] in eventos[0]["descripcion"]


# ---------------------------------------------------------------
# Notificaciones (campanita) — cuenta desactivada/reactivada
# ---------------------------------------------------------------

def test_notificaciones_vacias_al_principio():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    r = client.get("/api/v1/notificaciones/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == []

    r_conteo = client.get("/api/v1/notificaciones/me/conteo", headers={"Authorization": f"Bearer {token}"})
    assert r_conteo.json() == {"no_leidas": 0}


def test_reactivar_genera_notificacion_para_el_candidato():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_candidato = r_login.json()["access_token"]
    client.patch("/api/v1/auth/me/desactivar", headers={"Authorization": f"Bearer {token_candidato}"})

    token_admin = _crear_admin()
    client.patch(f"/api/v1/auth/usuarios/{candidato_id}/activar", headers={"Authorization": f"Bearer {token_admin}"})

    token_de_nuevo = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    r = client.get("/api/v1/notificaciones/me", headers={"Authorization": f"Bearer {token_de_nuevo}"})
    tipos = [n["tipo"] for n in r.json()]
    assert "cuenta_desactivada" in tipos
    assert "cuenta_reactivada" in tipos


def test_marcar_notificacion_como_leida():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_candidato = r_login.json()["access_token"]
    client.patch("/api/v1/auth/me/desactivar", headers={"Authorization": f"Bearer {token_candidato}"})

    token_admin = _crear_admin()
    client.patch(f"/api/v1/auth/usuarios/{candidato_id}/activar", headers={"Authorization": f"Bearer {token_admin}"})

    token_de_nuevo = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    notif_id = client.get("/api/v1/notificaciones/me", headers={"Authorization": f"Bearer {token_de_nuevo}"}).json()[0]["id"]

    r_marcar = client.patch(f"/api/v1/notificaciones/{notif_id}/leida", headers={"Authorization": f"Bearer {token_de_nuevo}"})
    assert r_marcar.status_code == 200
    assert r_marcar.json()["leida"] is True


def test_no_se_puede_marcar_leida_una_notificacion_de_otro_usuario():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_candidato = r_login.json()["access_token"]
    client.patch("/api/v1/auth/me/desactivar", headers={"Authorization": f"Bearer {token_candidato}"})

    token_admin = _crear_admin()
    client.patch(f"/api/v1/auth/usuarios/{candidato_id}/activar", headers={"Authorization": f"Bearer {token_admin}"})
    token_de_nuevo = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    notif_id = client.get("/api/v1/notificaciones/me", headers={"Authorization": f"Bearer {token_de_nuevo}"}).json()[0]["id"]

    client.post("/api/v1/auth/registro", json={**USUARIO_VALIDO, "email": "otro-notif@example.com", "cedula": "999888777"})
    token_otro = _token_de("otro-notif@example.com", USUARIO_VALIDO["password"])
    r = client.patch(f"/api/v1/notificaciones/{notif_id}/leida", headers={"Authorization": f"Bearer {token_otro}"})
    assert r.status_code == 404


def test_marcar_todas_leidas():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_candidato = r_login.json()["access_token"]
    client.patch("/api/v1/auth/me/desactivar", headers={"Authorization": f"Bearer {token_candidato}"})

    token_admin = _crear_admin()
    client.patch(f"/api/v1/auth/usuarios/{candidato_id}/activar", headers={"Authorization": f"Bearer {token_admin}"})
    token_de_nuevo = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])

    r_conteo_antes = client.get("/api/v1/notificaciones/me/conteo", headers={"Authorization": f"Bearer {token_de_nuevo}"})
    assert r_conteo_antes.json()["no_leidas"] == 2

    client.post("/api/v1/notificaciones/me/marcar-todas-leidas", headers={"Authorization": f"Bearer {token_de_nuevo}"})
    r_conteo_despues = client.get("/api/v1/notificaciones/me/conteo", headers={"Authorization": f"Bearer {token_de_nuevo}"})
    assert r_conteo_despues.json()["no_leidas"] == 0


# ---------------------------------------------------------------
# Correo (modo desarrollo: sin SMTP configurado, solo se registra en el log)
# ---------------------------------------------------------------

def test_olvide_password_intenta_enviar_correo_sin_fallar(monkeypatch):
    from app.services import email_service

    llamadas = []
    monkeypatch.setattr(
        email_service, "enviar_correo_reset_password",
        lambda destinatario, nombre, enlace: llamadas.append((destinatario, nombre, enlace)) or True,
    )
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r = client.post("/api/v1/auth/olvide-password", json={"email": USUARIO_VALIDO["email"]})
    assert r.status_code == 200
    assert len(llamadas) == 1
    assert llamadas[0][0] == USUARIO_VALIDO["email"]


def test_email_service_en_modo_desarrollo_no_falla_sin_smtp_configurado():
    from app.services.email_service import enviar_correo

    resultado = enviar_correo("prueba@example.com", "Asunto de prueba", "<p>Cuerpo</p>", "Cuerpo texto plano")
    assert resultado is True


def test_reactivar_requiere_rol_admin():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_candidato = r_login.json()["access_token"]

    r = client.patch(f"/api/v1/auth/usuarios/{candidato_id}/activar", headers={"Authorization": f"Bearer {token_candidato}"})
    assert r.status_code == 403


def test_reactivar_usuario_inexistente_da_404():
    token_admin = _crear_admin()
    r = client.patch("/api/v1/auth/usuarios/no-existe/activar", headers={"Authorization": f"Bearer {token_admin}"})
    assert r.status_code == 404


def test_auditoria_registra_desactivar_y_reactivar():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_candidato = r_login.json()["access_token"]
    client.patch("/api/v1/auth/me/desactivar", headers={"Authorization": f"Bearer {token_candidato}"})

    token_admin = _crear_admin()
    client.patch(f"/api/v1/auth/usuarios/{candidato_id}/activar", headers={"Authorization": f"Bearer {token_admin}"})

    r_auditoria = client.get("/api/v1/auth/auditoria", headers={"Authorization": f"Bearer {token_admin}"})
    tipos = [e["tipo"] for e in r_auditoria.json()]
    assert "cuenta_desactivada" in tipos
    assert "cuenta_reactivada" in tipos


def _crear_admin(email="admin-gestion@example.com", password="ClaveAdmin123"):
    from app.core.security import hash_password
    from app.models.usuario import Usuario, RolUsuario as R

    db = TestingSessionLocal()
    admin = Usuario(nombre_completo="Admin Gestión", email=email, password_hash=hash_password(password), rol=R.admin)
    db.add(admin)
    db.commit()
    db.close()
    return _token_de(email, password)


def test_cambiar_password_exitoso_y_login_con_la_nueva():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])

    r = client.patch(
        "/api/v1/auth/me/password",
        json={"password_actual": USUARIO_VALIDO["password"], "password_nueva": "NuevaClave456!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 204

    r_login_viejo = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    assert r_login_viejo.status_code == 401

    r_login_nuevo = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": "NuevaClave456!"})
    assert r_login_nuevo.status_code == 200


def test_cambiar_password_rechaza_password_actual_incorrecta():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])

    r = client.patch(
        "/api/v1/auth/me/password",
        json={"password_actual": "Incorrecta123", "password_nueva": "NuevaClave456!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 401


def test_actualizar_perfil_cambia_nombre_y_correo():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])

    r = client.patch(
        "/api/v1/auth/me",
        json={"nombre_completo": "Nombre Actualizado", "email": "nuevo-correo@example.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["nombre_completo"] == "Nombre Actualizado"
    assert r.json()["email"] == "nuevo-correo@example.com"

    # El login ahora es con el correo nuevo
    r_login = client.post("/api/v1/auth/login", json={"email": "nuevo-correo@example.com", "password": USUARIO_VALIDO["password"]})
    assert r_login.status_code == 200


def test_actualizar_perfil_rechaza_correo_ya_usado_por_otro():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    client.post("/api/v1/auth/registro", json={**USUARIO_VALIDO, "email": "otra-persona@example.com", "cedula": "999888777"})
    token = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])

    r = client.patch("/api/v1/auth/me", json={"email": "otra-persona@example.com"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 409


def test_listar_usuarios_requiere_rol_admin():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token_candidato = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    r = client.get("/api/v1/auth/usuarios", headers={"Authorization": f"Bearer {token_candidato}"})
    assert r.status_code == 403

    token_admin = _crear_admin()
    r_admin = client.get("/api/v1/auth/usuarios", headers={"Authorization": f"Bearer {token_admin}"})
    assert r_admin.status_code == 200
    assert len(r_admin.json()) >= 1


def test_listar_candidatos_requiere_gestion_o_admin():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token_candidato = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    r = client.get("/api/v1/auth/candidatos", headers={"Authorization": f"Bearer {token_candidato}"})
    assert r.status_code == 403


def test_listar_candidatos_solo_devuelve_rol_candidato():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token_admin = _crear_admin()
    client.post(
        "/api/v1/auth/usuarios-internos",
        json={"nombre_completo": "Gestora Interna", "email": "gestora-interna@example.com", "password": "ClaveSegura123!", "rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )

    r = client.get("/api/v1/auth/candidatos", headers={"Authorization": f"Bearer {token_admin}"})
    assert r.status_code == 200
    roles = {u["rol"] for u in r.json()}
    assert roles == {"candidato"}  # nunca debe incluir gestor_humano ni admin
    correos = {u["email"] for u in r.json()}
    assert USUARIO_VALIDO["email"] in correos
    assert "gestora-interna@example.com" not in correos


def test_gestor_humano_si_puede_listar_candidatos():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token_admin = _crear_admin()
    r_crear = client.post(
        "/api/v1/auth/usuarios-internos",
        json={"nombre_completo": "Gestora Dos", "email": "gestora-dos@example.com", "password": "ClaveSegura123!", "rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    token_gestor = _token_de("gestora-dos@example.com", "ClaveSegura123!")

    r = client.get("/api/v1/auth/candidatos", headers={"Authorization": f"Bearer {token_gestor}"})
    assert r.status_code == 200


def test_estadisticas_requiere_rol_admin():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token_candidato = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    r = client.get("/api/v1/auth/estadisticas", headers={"Authorization": f"Bearer {token_candidato}"})
    assert r.status_code == 403


def test_estadisticas_devuelve_conteos_reales():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    client.post("/api/v1/auth/registro", json={**USUARIO_VALIDO, "email": "otro-candidato@example.com", "cedula": "999888777"})
    token_admin = _crear_admin()

    r = client.get("/api/v1/auth/estadisticas", headers={"Authorization": f"Bearer {token_admin}"})
    assert r.status_code == 200
    data = r.json()
    # 2 candidatos registrados arriba + 1 admin sembrado por _crear_admin()
    assert data["total"] == 3
    assert data["por_rol"]["candidato"] == 2
    assert data["por_rol"]["admin"] == 1
    assert len(data["recientes"]) <= 5
    assert data["recientes"][0]["email"] in (USUARIO_VALIDO["email"], "otro-candidato@example.com", "admin-gestion@example.com")


def test_admin_puede_cambiar_el_rol_de_otro_usuario():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_registro = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_registro.json()["usuario"]["id"]

    token_admin = _crear_admin()
    r = client.patch(
        f"/api/v1/auth/usuarios/{candidato_id}",
        json={"rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert r.status_code == 200
    assert r.json()["rol"] == "gestor_humano"


def test_admin_puede_cambiar_solo_el_nombre_sin_tocar_el_rol():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_registro = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_registro.json()["usuario"]["id"]

    token_admin = _crear_admin()
    r = client.patch(
        f"/api/v1/auth/usuarios/{candidato_id}",
        json={"nombre_completo": "Nombre Corregido"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert r.status_code == 200
    assert r.json()["nombre_completo"] == "Nombre Corregido"
    assert r.json()["rol"] == "candidato"  # no se tocó


def test_admin_puede_cambiar_nombre_y_rol_a_la_vez():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_registro = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_registro.json()["usuario"]["id"]

    token_admin = _crear_admin()
    r = client.patch(
        f"/api/v1/auth/usuarios/{candidato_id}",
        json={"nombre_completo": "Nombre y Rol", "rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert r.status_code == 200
    assert r.json()["nombre_completo"] == "Nombre y Rol"
    assert r.json()["rol"] == "gestor_humano"


def test_editar_usuario_rechaza_nombre_muy_corto():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_registro = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_registro.json()["usuario"]["id"]

    token_admin = _crear_admin()
    r = client.patch(
        f"/api/v1/auth/usuarios/{candidato_id}",
        json={"nombre_completo": "Al"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert r.status_code == 422


def test_auditoria_describe_los_dos_cambios_cuando_se_editan_juntos():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_registro = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_registro.json()["usuario"]["id"]

    token_admin = _crear_admin()
    client.patch(
        f"/api/v1/auth/usuarios/{candidato_id}",
        json={"nombre_completo": "Editado Del Todo", "rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    r = client.get("/api/v1/auth/auditoria", headers={"Authorization": f"Bearer {token_admin}"})
    evento = next(e for e in r.json() if e["tipo"] == "usuario_editado")
    assert "nombre" in evento["descripcion"]
    assert "rol" in evento["descripcion"]
    assert "Editado Del Todo" in evento["descripcion"]


def _decodificar(token):
    from app.core.config import settings as cfg
    return jwt_lib_decode(token, cfg.SECRET_KEY, algorithms=[cfg.ALGORITHM])


def jwt_lib_decode(*args, **kwargs):
    import jwt as _jwt
    return _jwt.decode(*args, **kwargs)


def test_login_normal_da_token_de_corta_duracion():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"], "recordar": False})
    payload = _decodificar(r.json()["access_token"])
    vida_horas = (payload["exp"] - payload_iat_o_ahora(payload)) / 3600
    assert vida_horas <= 9  # ~8 horas, con margen


def payload_iat_o_ahora(payload):
    import time
    return payload.get("iat", time.time())


def test_login_con_recordar_da_token_de_larga_duracion():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"], "recordar": True})
    payload = _decodificar(r.json()["access_token"])
    dias_de_vida = (payload["exp"] - payload_iat_o_ahora(payload)) / 86400
    assert dias_de_vida > 20  # ~30 días configurados, con margen


def test_olvide_password_responde_igual_exista_o_no_el_correo():
    r_existe = client.post("/api/v1/auth/olvide-password", json={"email": "nadie-existe@example.com"})
    assert r_existe.status_code == 200
    assert "token_dev" not in r_existe.json()  # no existe el correo, no hay token que exponer

    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_si_existe = client.post("/api/v1/auth/olvide-password", json={"email": USUARIO_VALIDO["email"]})
    assert r_si_existe.status_code == 200
    assert "token_dev" in r_si_existe.json()  # en desarrollo, sí se expone para poder probar


def test_flujo_completo_restablecer_password():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_olvide = client.post("/api/v1/auth/olvide-password", json={"email": USUARIO_VALIDO["email"]})
    token_reset = r_olvide.json()["token_dev"]

    r_reset = client.post("/api/v1/auth/restablecer-password", json={"token": token_reset, "password_nueva": "NuevaClave789!"})
    assert r_reset.status_code == 204

    r_login_viejo = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    assert r_login_viejo.status_code == 401

    r_login_nuevo = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": "NuevaClave789!"})
    assert r_login_nuevo.status_code == 200


def test_restablecer_password_con_token_invalido():
    r = client.post("/api/v1/auth/restablecer-password", json={"token": "token-que-no-existe", "password_nueva": "NuevaClave789!"})
    assert r.status_code == 400


def test_restablecer_password_con_token_ya_usado_falla_la_segunda_vez():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_olvide = client.post("/api/v1/auth/olvide-password", json={"email": USUARIO_VALIDO["email"]})
    token_reset = r_olvide.json()["token_dev"]

    client.post("/api/v1/auth/restablecer-password", json={"token": token_reset, "password_nueva": "PrimeraVez123!"})
    r_segunda_vez = client.post("/api/v1/auth/restablecer-password", json={"token": token_reset, "password_nueva": "SegundaVez456!"})
    assert r_segunda_vez.status_code == 400


def test_restablecer_password_con_token_expirado():
    from app.models.usuario import Usuario as U
    from datetime import datetime, timedelta, timezone

    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_olvide = client.post("/api/v1/auth/olvide-password", json={"email": USUARIO_VALIDO["email"]})
    token_reset = r_olvide.json()["token_dev"]

    db = TestingSessionLocal()
    u = db.query(U).filter(U.reset_token == token_reset).first()
    u.reset_token_expira = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    db.close()

    r = client.post("/api/v1/auth/restablecer-password", json={"token": token_reset, "password_nueva": "NuevaClave789!"})
    assert r.status_code == 400


def test_cambiar_rol_requiere_admin():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_candidato = r_login.json()["access_token"]

    r = client.patch(
        f"/api/v1/auth/usuarios/{candidato_id}",
        json={"rol": "admin"},
        headers={"Authorization": f"Bearer {token_candidato}"},
    )
    assert r.status_code == 403


def test_cambiar_rol_de_usuario_inexistente_da_404():
    token_admin = _crear_admin()
    r = client.patch(
        "/api/v1/auth/usuarios/no-existe/rol",
        json={"rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert r.status_code == 404


def test_no_se_puede_quitar_el_rol_al_unico_admin():
    from app.core.security import hash_password
    from app.models.usuario import Usuario, RolUsuario as R

    db = TestingSessionLocal()
    unico = Usuario(nombre_completo="Único Admin", email="unico2@example.com", password_hash=hash_password("ClaveAdmin123"), rol=R.admin)
    db.add(unico)
    db.commit()
    unico_id = unico.id
    db.close()

    token = _token_de("unico2@example.com", "ClaveAdmin123")
    r = client.patch(
        f"/api/v1/auth/usuarios/{unico_id}",
        json={"rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 409


def test_rate_limit_login_bloquea_tras_muchos_intentos():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    # LIMITE_LOGIN = "10/minute" — el intento 11 dentro del mismo minuto debe bloquearse
    for _ in range(10):
        r = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": "incorrecta"})
        assert r.status_code == 401
    r_bloqueado = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": "incorrecta"})
    assert r_bloqueado.status_code == 429


def test_rate_limit_registro_bloquea_tras_muchos_intentos():
    # LIMITE_REGISTRO = "5/minute"
    for i in range(5):
        client.post("/api/v1/auth/registro", json={**USUARIO_VALIDO, "email": f"rate-{i}@example.com"})
    r_bloqueado = client.post("/api/v1/auth/registro", json={**USUARIO_VALIDO, "email": "rate-extra@example.com"})
    assert r_bloqueado.status_code == 429


def test_validar_configuracion_produccion_rechaza_secret_key_de_ejemplo(monkeypatch):
    from app.core import config as config_module

    monkeypatch.setattr(config_module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(config_module.settings, "SECRET_KEY", config_module.PLACEHOLDER_SECRET_KEY)
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        config_module.validar_configuracion_produccion()


def test_validar_configuracion_produccion_rechaza_cors_abierto(monkeypatch):
    from app.core import config as config_module

    monkeypatch.setattr(config_module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(config_module.settings, "SECRET_KEY", "una-clave-real-generada-aleatoriamente")
    monkeypatch.setattr(config_module.settings, "ALLOWED_ORIGINS", "*")
    with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS"):
        config_module.validar_configuracion_produccion()


def test_validar_configuracion_produccion_pasa_con_valores_reales(monkeypatch):
    from app.core import config as config_module

    monkeypatch.setattr(config_module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(config_module.settings, "SECRET_KEY", "una-clave-real-generada-aleatoriamente")
    monkeypatch.setattr(config_module.settings, "ALLOWED_ORIGINS", "https://seleccion.aguasnacionales.com")
    config_module.validar_configuracion_produccion()  # no debe lanzar nada


def test_validar_configuracion_produccion_no_aplica_en_desarrollo(monkeypatch):
    from app.core import config as config_module

    monkeypatch.setattr(config_module.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(config_module.settings, "SECRET_KEY", config_module.PLACEHOLDER_SECRET_KEY)
    config_module.validar_configuracion_produccion()  # en desarrollo no valida nada


def test_auditoria_requiere_rol_admin():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token_candidato = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    r = client.get("/api/v1/auth/auditoria", headers={"Authorization": f"Bearer {token_candidato}"})
    assert r.status_code == 403


def test_auditoria_registra_el_registro_publico():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token_admin = _crear_admin()
    r = client.get("/api/v1/auth/auditoria", headers={"Authorization": f"Bearer {token_admin}"})
    assert r.status_code == 200
    tipos = [e["tipo"] for e in r.json()]
    assert "usuario_registrado" in tipos


def test_auditoria_registra_creacion_de_cuenta_interna():
    token_admin = _crear_admin()
    client.post(
        "/api/v1/auth/usuarios-internos",
        json={"nombre_completo": "Gestora Auditoría", "email": "gestora-audit@example.com", "password": "ClaveSegura123!", "rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    r = client.get("/api/v1/auth/auditoria", headers={"Authorization": f"Bearer {token_admin}"})
    eventos = [e for e in r.json() if e["tipo"] == "usuario_creado_interno"]
    assert len(eventos) == 1
    assert "Gestora Auditoría" in eventos[0]["descripcion"]


def test_auditoria_registra_cambio_de_rol():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    r_login = client.post("/api/v1/auth/login", json={"email": USUARIO_VALIDO["email"], "password": USUARIO_VALIDO["password"]})
    candidato_id = r_login.json()["usuario"]["id"]
    token_admin = _crear_admin()

    client.patch(
        f"/api/v1/auth/usuarios/{candidato_id}",
        json={"rol": "gestor_humano"},
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    r = client.get("/api/v1/auth/auditoria", headers={"Authorization": f"Bearer {token_admin}"})
    eventos = [e for e in r.json() if e["tipo"] == "usuario_editado"]
    assert len(eventos) == 1
    assert "gestor_humano" in eventos[0]["descripcion"]


def test_auditoria_registra_eliminacion_de_cuenta():
    client.post("/api/v1/auth/registro", json=USUARIO_VALIDO)
    token_candidato = _token_de(USUARIO_VALIDO["email"], USUARIO_VALIDO["password"])
    client.delete("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_candidato}"})

    token_admin = _crear_admin()
    r = client.get("/api/v1/auth/auditoria", headers={"Authorization": f"Bearer {token_admin}"})
    eventos = [e for e in r.json() if e["tipo"] == "cuenta_eliminada"]
    assert len(eventos) == 1


def test_auditoria_respeta_el_limite():
    token_admin = _crear_admin()
    for i in range(3):
        client.post("/api/v1/auth/registro", json={**USUARIO_VALIDO, "email": f"limite-{i}@example.com", "cedula": f"11111{i}"})
    r = client.get("/api/v1/auth/auditoria?limite=2", headers={"Authorization": f"Bearer {token_admin}"})
    assert len(r.json()) == 2


def test_auditoria_ordena_del_mas_reciente_al_mas_antiguo():
    token_admin = _crear_admin()
    client.post("/api/v1/auth/registro", json={**USUARIO_VALIDO, "email": "primero@example.com", "cedula": "222220"})
    client.post("/api/v1/auth/registro", json={**USUARIO_VALIDO, "email": "segundo@example.com", "cedula": "222221"})
    r = client.get("/api/v1/auth/auditoria", headers={"Authorization": f"Bearer {token_admin}"})
    eventos = [e for e in r.json() if e["tipo"] == "usuario_registrado"]
    assert len(eventos) == 2
    assert "segundo@example.com" in eventos[0]["descripcion"]  # el más reciente va primero
    assert "primero@example.com" in eventos[1]["descripcion"]
