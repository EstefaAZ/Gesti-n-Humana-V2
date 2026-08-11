#!/usr/bin/env python3
# ==============================================================
# scripts/poblar_datos_prueba.py
#
# Crea datos de prueba REALES contra los 3 servidores corriendo en local
# (Login:9000, Vacantes:9001, Candidatos:9002) — vacantes con distintos
# criterios de evaluación, y candidatos con perfiles variados, algunos que
# CUMPLEN y otros que NO CUMPLEN a propósito, para poder revisar todo desde
# el panel de Gestión Humana (Candidatos, Vacantes, Reportes).
# ==============================================================

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

LOGIN = "http://localhost:9000"
VACANTES = "http://localhost:9001"
CANDIDATOS = "http://localhost:9002"


def _req(method, url, body=None, token=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            texto = resp.read().decode("utf-8")
            return resp.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode("utf-8")
        try:
            return e.code, json.loads(texto)
        except json.JSONDecodeError:
            return e.code, texto


def login(email, password):
    status, data = _req("POST", f"{LOGIN}/api/v1/auth/login", {"email": email, "password": password})
    if status != 200:
        return None
    return data["access_token"]


_ULTIMO_REGISTRO = [0.0]


def registrar_y_login(nombre, email, password):
    # El registro tiene un límite de 5 por minuto (protección contra abuso,
    # correcta y no se debe desactivar) — se espacian los intentos para no
    # chocar contra él, y si aun así pasa, se reintenta con espera.
    transcurrido = time.time() - _ULTIMO_REGISTRO[0]
    if transcurrido < 13:
        time.sleep(13 - transcurrido)

    intentos = 0
    while intentos < 6:
        status, _ = _req("POST", f"{LOGIN}/api/v1/auth/registro", {"nombre_completo": nombre, "email": email, "password": password})
        _ULTIMO_REGISTRO[0] = time.time()
        if status == 429:
            intentos += 1
            print(f"  ⏳ Límite de registro alcanzado, esperando 15s antes de reintentar con {nombre}…")
            time.sleep(15)
            continue
        break
    return login(email, password)


def crear_vacante(token, **kwargs):
    status, data = _req("POST", f"{VACANTES}/api/v1/vacantes", kwargs, token)
    if status != 201:
        print(f"  \u26a0\ufe0f  No se pudo crear la vacante '{kwargs.get('cargo')}': {data}")
        return None
    return data["id"]


def documentos_dummy():
    doc = {"nombre": "documento.pdf", "contenido_base64": "JVBERi0xLjQ="}
    return {"cedula": [doc], "certificados_laborales": [doc], "certificados_estudio": [doc], "tarjeta_profesional": [doc]}


def completar_perfil(token, nombre_completo, cedula, correo, celular, registros_ii, experiencia, conflicto=None, profesion="Profesional", tarjeta_profesional="TP000000"):
    body = {
        "datos_personales": {
            "nombreCompleto": nombre_completo, "cedula": cedula, "cedulaDe": "Medellín",
            "fechaNacimiento": "1995-06-15", "ciudadNacimiento": "Medellín", "deptoNacimiento": "Antioquia", "paisNacimiento": "Colombia",
            "correo": correo, "direccion": "Cra 1 # 1-01", "municipio": "Medellín", "deptoResidencia": "Antioquia",
            "telResidencia": "6041234567", "celular": celular,
            "estadoCivil": "Soltero(a)", "numHijos": "0",
            "licencia": "no", "licenciaClase": "", "tieneVehiculo": "no",
            "tarjetaProfesional": tarjeta_profesional, "profesion": profesion, "fechaTarjeta": "2020-01-01",
        },
        "registros_ii": registros_ii,
        "experiencia": experiencia,
        "conflicto": conflicto or {"tieneVinculo": "no", "familiares": []},
        "documentos_adjuntos": documentos_dummy(),
        "autorizacion": {"acepta": True, "nombre_completo": nombre_completo},
    }
    status, data = _req("PUT", f"{CANDIDATOS}/api/v1/perfiles/me", body, token)
    if status != 200:
        print(f"  \u26a0\ufe0f  No se pudo guardar el perfil de {nombre_completo}: {data}")
        return False
    return True


def inscribirme(token, vacante_id):
    status, data = _req("POST", f"{CANDIDATOS}/api/v1/solicitudes/inscribirme", {"vacante_id": vacante_id}, token)
    if status != 201:
        print(f"  \u26a0\ufe0f  No se pudo inscribir: {data}")
        return None
    return data["radicado"]


def main():
    parser = argparse.ArgumentParser(description="Poblar datos de prueba (vacantes + candidatos)")
    parser.add_argument("--admin-email", default="admin@aguasnacionalesepm.com")
    parser.add_argument("--admin-password", default="AdminProvisional123!")
    args = parser.parse_args()

    print("=== Iniciando sesion como admin ===")
    token_admin = login(args.admin_email, args.admin_password)
    if not token_admin:
        print(f"No se pudo iniciar sesion con {args.admin_email}.")
        print("   Crea un admin primero: cd backend/modulo_login && python scripts/crear_admin.py")
        print("   O corre este script con --admin-email y --admin-password correctos.")
        sys.exit(1)
    print("Sesion de admin iniciada.\n")

    print("=== Creando vacantes ===")

    vac_analista = crear_vacante(
        token_admin,
        proceso_no="2026-PRUEBA-01", cargo="Analista de Gestion Ambiental",
        descripcion="Buscamos un perfil universitario con experiencia real en temas ambientales.",
        area="Gestion Ambiental", sede="Medellin", plazas=1,
        criterios={"nivel_educativo_min": "Universitario", "graduado_requerido": True, "experiencia_min_anios": 2},
    )
    print(f"  Analista de Gestion Ambiental (Universitario + 2 anios exp.) -> {vac_analista}")

    vac_tecnico = crear_vacante(
        token_admin,
        proceso_no="2026-PRUEBA-02", cargo="Tecnico Operativo de Planta",
        descripcion="Vacante de nivel de entrada, sin requisitos estrictos de experiencia.",
        area="Operaciones", sede="Bello", plazas=2,
        criterios={},
    )
    print(f"  Tecnico Operativo de Planta (sin criterios estrictos) -> {vac_tecnico}")

    vac_ingeniero = crear_vacante(
        token_admin,
        proceso_no="2026-PRUEBA-03", cargo="Ingeniero Senior de Proyectos",
        descripcion="Cargo de alta responsabilidad - se requiere posgrado, experiencia amplia e ingles.",
        area="Ingenieria", sede="Medellin", plazas=1,
        criterios={
            "nivel_educativo_min": "Postgrado", "graduado_requerido": True, "experiencia_min_anios": 5,
            "idioma_requerido": "Ingles", "idioma_nivel_min": "Bien", "idioma_habilidad": "habla",
        },
    )
    print(f"  Ingeniero Senior de Proyectos (Postgrado + 5 anios + ingles) -> {vac_ingeniero}")

    vac_auxiliar = crear_vacante(
        token_admin,
        proceso_no="2026-PRUEBA-04", cargo="Auxiliar Administrativo",
        descripcion="Requiere certificacion especifica en Excel avanzado.",
        area="Administrativa", sede="Medellin", plazas=1,
        criterios={"certificaciones_keywords": ["Excel"]},
    )
    print(f"  Auxiliar Administrativo (requiere certificacion Excel) -> {vac_auxiliar}\n")

    print("=== Creando candidatos e inscribiendolos ===\n")
    resumen = []

    candidatos = [
        (
            "Laura Gomez Restrepo", "1017111111", "laura.gomez.prueba@example.com", vac_analista, "Analista Ambiental",
            "CUMPLE TODO (estudios + experiencia)",
            [{"tipo": "estudio", "nivelEducativo": "Universitario", "titulo": "Ingenieria Ambiental", "establecimiento": "Universidad de Antioquia", "graduado": "si", "terminacion": "2019-12"}],
            [{"empresa": "Aguas del Sur", "cargo": "Analista Ambiental", "fechaInicio": "2020-01-01", "fechaTerminacion": "2023-06-01", "dedicacion": "Tiempo completo"}],
            None,
        ),
        (
            "Andres Perez Lopez", "1017222222", "andres.perez.prueba@example.com", vac_analista, "Analista Ambiental",
            "NO CUMPLE (ni estudios ni experiencia)",
            [{"tipo": "estudio", "nivelEducativo": "Tecnico", "titulo": "Tecnico en Saneamiento", "graduado": "si"}],
            [{"empresa": "Empresa X", "cargo": "Auxiliar", "fechaInicio": "2025-06-01", "fechaTerminacion": "2025-12-01", "dedicacion": "Tiempo completo"}],
            None,
        ),
        (
            "Camila Ruiz Ortiz", "1017333333", "camila.ruiz.prueba@example.com", vac_analista, "Analista Ambiental",
            "CUMPLE ESTUDIOS, NO CUMPLE EXPERIENCIA",
            [{"tipo": "estudio", "nivelEducativo": "Universitario", "titulo": "Ingenieria Ambiental", "graduado": "si", "terminacion": "2024-12"}],
            [{"empresa": "Consultora Verde", "cargo": "Practicante", "fechaInicio": "2025-01-01", "fechaTerminacion": "2025-07-01", "dedicacion": "Medio tiempo"}],
            None,
        ),
        (
            "Julian Torres Vera", "1017444444", "julian.torres.prueba@example.com", vac_tecnico, "Tecnico Operativo",
            "CUMPLE (sin criterios estrictos configurados)",
            [{"tipo": "estudio", "nivelEducativo": "Secundarios", "titulo": "Bachiller Academico", "graduado": "si"}],
            [],
            None,
        ),
        (
            "Mariana Salazar Velez", "1017555555", "mariana.salazar.prueba@example.com", vac_ingeniero, "Ingeniero Senior",
            "CUMPLE TODO (posgrado + experiencia + ingles)",
            [
                {"tipo": "estudio", "nivelEducativo": "Postgrado", "titulo": "Maestria en Ingenieria", "graduado": "si", "terminacion": "2018-12"},
                {"tipo": "idioma", "idioma": "Ingles", "habla": "Muy bien", "lee": "Muy bien", "escribe": "Bien"},
            ],
            [{"empresa": "Ingenieria Global SAS", "cargo": "Coordinadora de Proyectos", "fechaInicio": "2017-01-01", "actual": True, "dedicacion": "Tiempo completo"}],
            None,
        ),
        (
            "Diego Ramirez Cano", "1017666666", "diego.ramirez.prueba@example.com", vac_ingeniero, "Ingeniero Senior",
            "CUMPLE ESTUDIOS Y EXPERIENCIA, NO CUMPLE INGLES",
            [
                {"tipo": "estudio", "nivelEducativo": "Postgrado", "titulo": "Especializacion en Gerencia de Proyectos", "graduado": "si", "terminacion": "2017-12"},
                {"tipo": "idioma", "idioma": "Ingles", "habla": "Regular", "lee": "Regular", "escribe": "Regular"},
            ],
            [{"empresa": "Constructora Andina", "cargo": "Ingeniero de Proyectos", "fechaInicio": "2016-01-01", "fechaTerminacion": "2023-06-01", "dedicacion": "Tiempo completo"}],
            None,
        ),
        (
            "Sofia Londono Marin", "1017777777", "sofia.londono.prueba@example.com", vac_auxiliar, "Auxiliar Administrativo",
            "CUMPLE (tiene la certificacion de Excel requerida)",
            [{"tipo": "certificacion", "nombreNorma": "Excel Avanzado", "enteCertificador": "SENA"}],
            [{"empresa": "Oficina Central", "cargo": "Auxiliar Administrativa", "fechaInicio": "2022-01-01", "fechaTerminacion": "2024-01-01", "dedicacion": "Tiempo completo"}],
            None,
        ),
        (
            "Esteban Marin Cardona", "1017888888", "esteban.marin.prueba@example.com", vac_tecnico, "Tecnico Operativo",
            "CUMPLE, ADEMAS DECLARA CONFLICTO DE INTERES",
            [{"tipo": "estudio", "nivelEducativo": "Tecnico", "titulo": "Tecnico en Mantenimiento", "graduado": "si"}],
            [{"empresa": "Planta Norte", "cargo": "Tecnico", "fechaInicio": "2021-01-01", "fechaTerminacion": "2024-01-01", "dedicacion": "Tiempo completo"}],
            {"tieneVinculo": "si", "familiares": [{"parentesco": "Tio", "nombreEmpleado": "Roberto Marin", "cargo": "Supervisor de Planta"}]},
        ),
    ]

    for nombre, cedula, correo, vacante_id, vacante_nombre, esperado, registros, experiencia, conflicto in candidatos:
        if not vacante_id:
            print(f"  Saltando a {nombre} (la vacante no se creo).")
            continue
        token_cand = registrar_y_login(nombre, correo, "ClavePrueba123!")
        if not token_cand:
            print(f"  No se pudo registrar/iniciar sesion con {nombre}.")
            continue
        profesion = next((r["titulo"] for r in registros if r.get("tipo") == "estudio" and r.get("titulo")), "Profesional")
        tarjeta = f"TP-{cedula[-6:]}"
        if not completar_perfil(token_cand, nombre, cedula, correo, "3000000000", registros, experiencia, conflicto, profesion, tarjeta):
            continue
        radicado = inscribirme(token_cand, vacante_id)
        if radicado:
            print(f"  OK {nombre} -> {vacante_nombre} (radicado {radicado}) -- esperado: {esperado}")
            resumen.append((nombre, correo, vacante_nombre, radicado, esperado))

    print("\n=== Listo ===")
    print(f"{len(resumen)} candidatos inscritos correctamente. Contrasena de todos: ClavePrueba123!\n")
    print(f"{'Candidato':<26} {'Vacante':<20} {'Radicado':<16} Resultado esperado")
    print("-" * 110)
    for nombre, correo, vacante_nombre, radicado, esperado in resumen:
        print(f"{nombre:<26} {vacante_nombre:<20} {radicado:<16} {esperado}")

    print("\nRevisalo en Gestion Humana -> Vacantes, Candidatos, o descarga el Reporte de cada vacante.")


if __name__ == "__main__":
    main()
