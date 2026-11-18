#!/usr/bin/env python3
# ==============================================================
# scripts/poblar_datos_prueba.py

import argparse
import calendar
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta


def _tiempo_transcurrido(inicio: date, fin: date) -> str:
    """Texto 'X año(s), Y mes(es), Z día(s)' entre dos fechas — para poder
    calcular tiempoLaborado de una experiencia que sigue vigente (actual)
    en vez de dejarlo como un valor fijo que quedaria desactualizado."""
    anios = fin.year - inicio.year
    meses = fin.month - inicio.month
    dias = fin.day - inicio.day
    if dias < 0:
        meses -= 1
        mes_prev = fin.month - 1 or 12
        anio_prev = fin.year if fin.month > 1 else fin.year - 1
        dias += calendar.monthrange(anio_prev, mes_prev)[1]
    if meses < 0:
        meses += 12
        anios -= 1
    return f"{anios} año(s), {meses} mes(es), {dias} día(s)"


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


def completar_perfil(
    token, nombre_completo, cedula, correo, registros_ii, experiencia, conflicto=None,
    profesion="Profesional", tarjeta_profesional="TP000000",
    # El resto de datos_personales tenia estos valores fijos para todos los
    # candidatos; se parametrizan (con el mismo valor de siempre por default)
    # para poder darle a cada candidato datos completos y distintos sin tocar
    # el comportamiento de los demas.
    celular="3000000000",
    cedula_de="Medellín", fecha_nacimiento="1995-06-15", ciudad_nacimiento="Medellín",
    depto_nacimiento="Antioquia", pais_nacimiento="Colombia",
    direccion="Cra 1 # 1-01", municipio="Medellín", depto_residencia="Antioquia",
    tel_residencia="6041234567", estado_civil="Soltero(a)", num_hijos="0",
    licencia="no", licencia_clase="", tiene_vehiculo="no", fecha_tarjeta="2020-01-01",
):
    body = {
        "datos_personales": {
            "nombreCompleto": nombre_completo, "cedula": cedula, "cedulaDe": cedula_de,
            "fechaNacimiento": fecha_nacimiento, "ciudadNacimiento": ciudad_nacimiento, "deptoNacimiento": depto_nacimiento, "paisNacimiento": pais_nacimiento,
            "correo": correo, "direccion": direccion, "municipio": municipio, "deptoResidencia": depto_residencia,
            "telResidencia": tel_residencia, "celular": celular,
            "estadoCivil": estado_civil, "numHijos": num_hijos,
            "licencia": licencia, "licenciaClase": licencia_clase, "tieneVehiculo": tiene_vehiculo,
            "tarjetaProfesional": tarjeta_profesional, "profesion": profesion, "fechaTarjeta": fecha_tarjeta,
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

    hoy = date.today()

    vac_analista = crear_vacante(
        token_admin,
        proceso_no="2026-PRUEBA-01", cargo="Analista de Gestion Ambiental",
        descripcion="Buscamos un perfil universitario con experiencia real en temas ambientales.",
        area="Gestion Ambiental", sede="Medellin", plazas=1,
        salario="3.600.000", tipo_vinculacion="Término indefinido", publico_objetivo="Externo",
        fecha_apertura=hoy.isoformat(), fecha_cierre=(hoy + timedelta(days=30)).isoformat(), hora_cierre="17:00",
        requisitos_obligatorios="Disponibilidad para trabajo de campo y visitas a plantas de tratamiento.",
        conocimientos_complementarios="Manejo de indicadores ambientales, normatividad SST y herramientas ofimáticas.",
        criterios={"nivel_educativo_min": "Universitario", "graduado_requerido": True, "experiencia_min_anios": 2},
    )
    print(f"  Analista de Gestion Ambiental (Universitario + 2 anios exp.) -> {vac_analista}")

    vac_tecnico = crear_vacante(
        token_admin,
        proceso_no="2026-PRUEBA-02", cargo="Tecnico Operativo de Planta",
        descripcion="Vacante de nivel de entrada, sin requisitos estrictos de experiencia.",
        area="Operaciones", sede="Bello", plazas=2,
        salario="1.800.000", tipo_vinculacion="Término fijo", publico_objetivo="Externo",
        fecha_apertura=hoy.isoformat(), fecha_cierre=(hoy + timedelta(days=30)).isoformat(), hora_cierre="16:00",
        requisitos_obligatorios="Disponibilidad para turnos rotativos y trabajo en planta.",
        conocimientos_complementarios="Conocimientos básicos en mantenimiento de equipos industriales.",
        criterios={},
    )
    print(f"  Tecnico Operativo de Planta (sin criterios estrictos) -> {vac_tecnico}")

    vac_ingeniero = crear_vacante(
        token_admin,
        proceso_no="2026-PRUEBA-03", cargo="Ingeniero Senior de Proyectos",
        descripcion="Cargo de alta responsabilidad - se requiere posgrado, experiencia amplia e ingles.",
        area="Ingenieria", sede="Medellin", plazas=1,
        salario="7.800.000", tipo_vinculacion="Término indefinido", publico_objetivo="Ambos",
        fecha_apertura=hoy.isoformat(), fecha_cierre=(hoy + timedelta(days=30)).isoformat(), hora_cierre="18:00",
        requisitos_obligatorios="Disponibilidad para viajar a otras sedes y liderar equipos multidisciplinarios.",
        conocimientos_complementarios="Gestión de proyectos (PMI), manejo de presupuestos y herramientas de planeación (MS Project).",
        criterios={
            "nivel_educativo_min": "Postgrado", "graduado_requerido": True, "experiencia_min_anios": 5,
            "idioma_requerido": "Ingles", "idioma_nivel_min": "Intermedio",
        },
    )
    print(f"  Ingeniero Senior de Proyectos (Postgrado + 5 anios + ingles) -> {vac_ingeniero}")

    vac_auxiliar = crear_vacante(
        token_admin,
        proceso_no="2026-PRUEBA-04", cargo="Auxiliar Administrativo",
        descripcion="Requiere certificacion especifica en Excel avanzado.",
        area="Administrativa", sede="Medellin", plazas=1,
        salario="2.200.000", tipo_vinculacion="Término fijo", publico_objetivo="Ambos",
        fecha_apertura=hoy.isoformat(), fecha_cierre=(hoy + timedelta(days=30)).isoformat(), hora_cierre="17:00",
        requisitos_obligatorios="Manejo de archivo físico y digital, atención a proveedores internos.",
        conocimientos_complementarios="Excel avanzado (tablas dinámicas), redacción de documentos administrativos.",
        criterios={"certificaciones_keywords": ["Excel"]},
    )
    print(f"  Auxiliar Administrativo (requiere certificacion Excel) -> {vac_auxiliar}\n")

    vac_completa = crear_vacante(
        token_admin,
        proceso_no="2026-PRUEBA-05", cargo="Especialista en Datos y Reportes",
        descripcion="Vacante de referencia con TODOS los campos diligenciados, para revisar visualmente el PDF (GTH-FOR-03) y el reporte Excel (GTH-FOR-04) con datos completos.",
        area="Tecnologia e Innovacion", sede="Medellin", plazas=1,
        salario="6.500.000", tipo_vinculacion="Termino indefinido", publico_objetivo="Externo",
        fecha_apertura=hoy.isoformat(), fecha_cierre=(hoy + timedelta(days=30)).isoformat(), hora_cierre="17:30",
        requisitos_obligatorios="Disponibilidad para viajar ocasionalmente y manejo avanzado de herramientas ofimaticas.",
        conocimientos_complementarios="Power BI, SQL y metodologias agiles de gestion de proyectos.",
        criterios={
            "nivel_educativo_min": "Universitario", "graduado_requerido": True,
            "profesion_keyword": "ingenieria", "experiencia_min_anios": 3,
            "idioma_requerido": "Ingles", "idioma_nivel_min": "Intermedio",
            "certificaciones_keywords": ["Excel", "Power BI"],
        },
    )
    print(f"  Especialista en Datos y Reportes (TODOS los campos llenos) -> {vac_completa}\n")

    print("=== Creando candidatos e inscribiendolos ===\n")
    resumen = []

    # Mariana sigue empleada (actual=True): el tiempo laborado se calcula
    # contra la fecha de hoy en vez de dejarlo fijo, para que no quede
    # desactualizado cada vez que se corra el script.
    tiempo_mariana = _tiempo_transcurrido(date(2017, 1, 1), hoy)

    candidatos = [
        (
            "Laura Gomez Restrepo", "1017111111", "laura.gomez.prueba@example.com", vac_analista, "Analista Ambiental",
            "CUMPLE TODO (estudios + experiencia)",
            [{
                "tipo": "estudio", "nivelEducativo": "Universitario", "titulo": "Ingenieria Ambiental",
                "establecimiento": "Universidad de Antioquia", "departamento": "Antioquia", "ciudad": "Medellin",
                "graduado": "si", "inicio": "2014-01", "terminacion": "2019-12",
            }, {
                "tipo": "idioma", "idioma": "Ingles", "establecimiento": "Centro Colombo Americano",
                "fecha": "2020-04", "nivel": "Intermedio",
            }],
            [{
                "empresa": "Fundacion Ambiente Vivo", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Medellin",
                "tipoEmpresa": "Sin animo de lucro", "proceso": "Educacion Ambiental Comunitaria", "jefeInmediato": "Marcela Isabel Uribe",
                "telEmpresa": "6042117744", "cargo": "Auxiliar de Proyectos Ambientales",
                "fechaInicio": "2018-03-01", "fechaTerminacion": "2019-09-01", "actual": False,
                "tiempoLaborado": "1 año(s), 6 mes(es), 0 día(s)", "dedicacion": "Medio tiempo",
                "motivoRetiro": "Finalizacion del proyecto financiado",
            }, {
                "empresa": "Aguas del Sur S.A. E.S.P.", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Medellin",
                "tipoEmpresa": "Privada", "proceso": "Gestion Ambiental y Sostenibilidad", "jefeInmediato": "Carlos Eduardo Restrepo",
                "telEmpresa": "6044223311", "cargo": "Analista Ambiental",
                "fechaInicio": "2020-01-01", "fechaTerminacion": "2023-06-01", "actual": False,
                "tiempoLaborado": "3 año(s), 5 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Finalizacion de contrato",
            }],
            {"tieneVinculo": "no", "familiares": [], "tieneOtraInhabilidad": "no", "descripcionInhabilidad": ""},
            {
                "celular": "3007654321",
                "cedula_de": "Medellin", "fecha_nacimiento": "1996-03-14", "ciudad_nacimiento": "Medellin",
                "depto_nacimiento": "Antioquia", "pais_nacimiento": "Colombia",
                "direccion": "Calle 33 # 76-20", "municipio": "Medellin", "depto_residencia": "Antioquia",
                "tel_residencia": "6042332211", "estado_civil": "Soltero(a)", "num_hijos": "0",
                "licencia": "no", "licencia_clase": "", "tiene_vehiculo": "no", "fecha_tarjeta": "2021-02-01",
            },
        ),
        (
            "Andres Perez Lopez", "1017222222", "andres.perez.prueba@example.com", vac_analista, "Analista Ambiental",
            "NO CUMPLE (ni estudios ni experiencia)",
            [{
                "tipo": "estudio", "nivelEducativo": "Tecnico", "titulo": "Tecnico en Saneamiento",
                "establecimiento": "SENA - Regional Bogota", "departamento": "Bogota D.C.", "ciudad": "Bogota D.C.",
                "graduado": "si", "inicio": "2013-01", "terminacion": "2014-12",
            }],
            [{
                "empresa": "Distribuidora La Sabana SAS", "pais": "Colombia", "departamento": "Bogota D.C.", "ciudad": "Bogota D.C.",
                "tipoEmpresa": "Privada", "proceso": "Logistica y Bodegaje", "jefeInmediato": "Hector Julio Nieto",
                "telEmpresa": "6013001122", "cargo": "Auxiliar de Bodega",
                "fechaInicio": "2024-01-01", "fechaTerminacion": "2024-08-01", "actual": False,
                "tiempoLaborado": "0 año(s), 7 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Fin de contrato por obra o labor",
            }, {
                "empresa": "Aseo Urbano de Bogota SAS", "pais": "Colombia", "departamento": "Bogota D.C.", "ciudad": "Bogota D.C.",
                "tipoEmpresa": "Privada", "proceso": "Manejo de Residuos Solidos", "jefeInmediato": "Diana Marcela Rojas",
                "telEmpresa": "6014455223", "cargo": "Auxiliar",
                "fechaInicio": "2025-06-01", "fechaTerminacion": "2025-12-01", "actual": False,
                "tiempoLaborado": "0 año(s), 6 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Contrato temporal finalizado",
            }],
            {"tieneVinculo": "no", "familiares": [], "tieneOtraInhabilidad": "no", "descripcionInhabilidad": ""},
            {
                "celular": "3018529637",
                "cedula_de": "Bogota D.C.", "fecha_nacimiento": "1990-07-22", "ciudad_nacimiento": "Bogota D.C.",
                "depto_nacimiento": "Bogota D.C.", "pais_nacimiento": "Colombia",
                "direccion": "Carrera 15 # 80-45", "municipio": "Bogota D.C.", "depto_residencia": "Bogota D.C.",
                "tel_residencia": "6013456789", "estado_civil": "Union libre", "num_hijos": "1",
                "licencia": "si", "licencia_clase": "C1", "tiene_vehiculo": "si", "fecha_tarjeta": "2015-11-20",
            },
        ),
        (
            "Camila Ruiz Ortiz", "1017333333", "camila.ruiz.prueba@example.com", vac_analista, "Analista Ambiental",
            "CUMPLE ESTUDIOS, NO CUMPLE EXPERIENCIA",
            [{
                "tipo": "estudio", "nivelEducativo": "Universitario", "titulo": "Ingenieria Ambiental",
                "establecimiento": "Universidad del Valle", "departamento": "Valle del Cauca", "ciudad": "Cali",
                "graduado": "si", "inicio": "2020-01", "terminacion": "2024-12",
            }, {
                "tipo": "certificacion", "nombreNorma": "ISO 14001 - Sistemas de Gestion Ambiental",
                "numDocumento": "ISO14001-7732", "fechaCertificado": "2025-02", "enteCertificador": "ICONTEC",
            }],
            [{
                "empresa": "Fundacion EcoRegion", "pais": "Colombia", "departamento": "Valle del Cauca", "ciudad": "Cali",
                "tipoEmpresa": "Sin animo de lucro", "proceso": "Monitoreo de Fuentes Hidricas", "jefeInmediato": "Paula Andrea Mosquera",
                "telEmpresa": "6023889911", "cargo": "Auxiliar de Campo",
                "fechaInicio": "2024-06-01", "fechaTerminacion": "2024-11-01", "actual": False,
                "tiempoLaborado": "0 año(s), 5 mes(es), 0 día(s)", "dedicacion": "Medio tiempo",
                "motivoRetiro": "Finalizacion del convenio",
            }, {
                "empresa": "Consultora Verde SAS", "pais": "Colombia", "departamento": "Valle del Cauca", "ciudad": "Cali",
                "tipoEmpresa": "Privada", "proceso": "Auditorias Ambientales", "jefeInmediato": "Andres Felipe Gonzalez",
                "telEmpresa": "6023341122", "cargo": "Practicante",
                "fechaInicio": "2025-01-01", "fechaTerminacion": "2025-07-01", "actual": False,
                "tiempoLaborado": "0 año(s), 6 mes(es), 0 día(s)", "dedicacion": "Medio tiempo",
                "motivoRetiro": "Fin de practica universitaria",
            }],
            {
                "tieneVinculo": "si", "familiares": [{"parentesco": "Cuñado(a)", "nombreEmpleado": "Julian David Marroquin", "cargo": "Coordinador de Compras"}],
                "tieneOtraInhabilidad": "no", "descripcionInhabilidad": "",
            },
            {
                "celular": "3102223344",
                "cedula_de": "Cali", "fecha_nacimiento": "2000-01-30", "ciudad_nacimiento": "Cali",
                "depto_nacimiento": "Valle del Cauca", "pais_nacimiento": "Colombia",
                "direccion": "Avenida 6N # 23-10", "municipio": "Cali", "depto_residencia": "Valle del Cauca",
                "tel_residencia": "6024551122", "estado_civil": "Soltero(a)", "num_hijos": "0",
                "licencia": "si", "licencia_clase": "A2", "tiene_vehiculo": "no", "fecha_tarjeta": "2022-06-15",
            },
        ),
        (
            "Julian Torres Vera", "1017444444", "julian.torres.prueba@example.com", vac_tecnico, "Tecnico Operativo",
            "CUMPLE (sin criterios estrictos configurados)",
            [{
                "tipo": "estudio", "nivelEducativo": "Secundarios", "titulo": "Bachiller Academico",
                "establecimiento": "Institucion Educativa San Jose", "departamento": "Antioquia", "ciudad": "Bello",
                "graduado": "si", "inicio": "2013-01", "terminacion": "2016-11",
            }],
            [{
                "empresa": "Ferreteria y Suministros El Progreso", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Bello",
                "tipoEmpresa": "Privada", "proceso": "Logistica y Bodegaje", "jefeInmediato": "Wilson Alberto Cano",
                "telEmpresa": "6044009911", "cargo": "Auxiliar de Bodega",
                "fechaInicio": "2023-06-01", "fechaTerminacion": "2024-05-01", "actual": False,
                "tiempoLaborado": "0 año(s), 11 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Finalizacion de contrato temporal",
            }],
            {"tieneVinculo": "no", "familiares": [], "tieneOtraInhabilidad": "no", "descripcionInhabilidad": ""},
            {
                "celular": "3204445566",
                "cedula_de": "Bello", "fecha_nacimiento": "1998-09-05", "ciudad_nacimiento": "Bello",
                "depto_nacimiento": "Antioquia", "pais_nacimiento": "Colombia",
                "direccion": "Carrera 50 # 10-30", "municipio": "Bello", "depto_residencia": "Antioquia",
                "tel_residencia": "6044441122", "estado_civil": "Soltero(a)", "num_hijos": "0",
                "licencia": "no", "licencia_clase": "", "tiene_vehiculo": "no", "fecha_tarjeta": "2023-01-10",
            },
        ),
        (
            "Mariana Salazar Velez", "1017555555", "mariana.salazar.prueba@example.com", vac_ingeniero, "Ingeniero Senior",
            "CUMPLE TODO (posgrado + experiencia + ingles)",
            [
                {
                    "tipo": "estudio", "nivelEducativo": "Universitario", "titulo": "Ingenieria Industrial",
                    "establecimiento": "Universidad Nacional de Colombia", "departamento": "Antioquia", "ciudad": "Medellin",
                    "graduado": "si", "inicio": "2004-01", "terminacion": "2009-12",
                },
                {
                    "tipo": "estudio", "nivelEducativo": "Postgrado", "titulo": "Maestria en Ingenieria",
                    "establecimiento": "Universidad EAFIT", "departamento": "Antioquia", "ciudad": "Medellin",
                    "graduado": "si", "inicio": "2017-01", "terminacion": "2018-12",
                },
                {
                    "tipo": "certificacion", "nombreNorma": "PMP - Project Management Professional",
                    "numDocumento": "PMP-2295841", "fechaCertificado": "2019-09", "enteCertificador": "Project Management Institute",
                },
                {"tipo": "idioma", "idioma": "Ingles", "establecimiento": "Centro Colombo Americano", "fecha": "2019-03", "nivel": "Avanzado"},
            ],
            [{
                "empresa": "Consultoria Ambiental y de Ingenieria SAS", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Medellin",
                "tipoEmpresa": "Privada", "proceso": "Diseno de Proyectos de Infraestructura", "jefeInmediato": "Gustavo Adolfo Herrera",
                "telEmpresa": "6042001133", "cargo": "Ingeniera Junior de Proyectos",
                "fechaInicio": "2010-02-01", "fechaTerminacion": "2013-06-01", "actual": False,
                "tiempoLaborado": "3 año(s), 4 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Oferta laboral con mejores condiciones",
            }, {
                "empresa": "Estructuras y Disenos del Oriente SAS", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Medellin",
                "tipoEmpresa": "Privada", "proceso": "Diseno Estructural", "jefeInmediato": "Monica Liliana Cadavid",
                "telEmpresa": "6042774488", "cargo": "Ingeniera de Diseño",
                "fechaInicio": "2013-07-01", "fechaTerminacion": "2016-12-01", "actual": False,
                "tiempoLaborado": "3 año(s), 5 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Oportunidad de crecimiento profesional",
            }, {
                "empresa": "Ingenieria Global SAS", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Medellin",
                "tipoEmpresa": "Privada", "proceso": "Gerencia de Proyectos de Ingenieria", "jefeInmediato": "Ricardo Andres Muñoz",
                "telEmpresa": "6043221199", "cargo": "Coordinadora de Proyectos",
                "fechaInicio": "2017-01-01", "actual": True,
                "tiempoLaborado": tiempo_mariana, "dedicacion": "Tiempo completo",
            }],
            {
                "tieneVinculo": "si", "familiares": [{"parentesco": "Suegro(a)", "nombreEmpleado": "Hernan Dario Salazar", "cargo": "Gerente de Operaciones"}],
                "tieneOtraInhabilidad": "no", "descripcionInhabilidad": "",
            },
            {
                "celular": "3135556677",
                "cedula_de": "Medellin", "fecha_nacimiento": "1985-05-18", "ciudad_nacimiento": "Medellin",
                "depto_nacimiento": "Antioquia", "pais_nacimiento": "Colombia",
                "direccion": "Transversal 39 # 72-15", "municipio": "Medellin", "depto_residencia": "Antioquia",
                "tel_residencia": "6042229988", "estado_civil": "Casado(a)", "num_hijos": "2",
                "licencia": "si", "licencia_clase": "B1", "tiene_vehiculo": "si", "fecha_tarjeta": "2010-03-08",
            },
        ),
        (
            "Diego Ramirez Cano", "1017666666", "diego.ramirez.prueba@example.com", vac_ingeniero, "Ingeniero Senior",
            "CUMPLE ESTUDIOS Y EXPERIENCIA, NO CUMPLE INGLES",
            [
                {
                    "tipo": "estudio", "nivelEducativo": "Postgrado", "titulo": "Especializacion en Gerencia de Proyectos",
                    "establecimiento": "Universidad Industrial de Santander", "departamento": "Santander", "ciudad": "Bucaramanga",
                    "graduado": "si", "inicio": "2017-01", "terminacion": "2017-12",
                },
                {"tipo": "idioma", "idioma": "Ingles", "establecimiento": "Instituto Colombo Britanico", "fecha": "2016-05", "nivel": "Basico"},
                {
                    "tipo": "certificacion", "nombreNorma": "Diseño y Gestion de Proyectos Viales",
                    "numDocumento": "DGPV-44120", "fechaCertificado": "2015-11", "enteCertificador": "Camara Colombiana de la Infraestructura",
                },
            ],
            [{
                "empresa": "Ingenieria y Obras del Nororiente SAS", "pais": "Colombia", "departamento": "Santander", "ciudad": "Bucaramanga",
                "tipoEmpresa": "Privada", "proceso": "Construccion de Vias Secundarias", "jefeInmediato": "Wilmer Alonso Perez",
                "telEmpresa": "6076339911", "cargo": "Ingeniero Residente",
                "fechaInicio": "2016-01-01", "fechaTerminacion": "2018-02-01", "actual": False,
                "tiempoLaborado": "2 año(s), 1 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Finalizacion del proyecto",
            }, {
                "empresa": "Constructora Andina SAS", "pais": "Colombia", "departamento": "Santander", "ciudad": "Bucaramanga",
                "tipoEmpresa": "Privada", "proceso": "Construccion de Infraestructura Vial", "jefeInmediato": "Jorge Ivan Delgado",
                "telEmpresa": "6076541122", "cargo": "Ingeniero de Proyectos",
                "fechaInicio": "2018-03-01", "fechaTerminacion": "2021-05-01", "actual": False,
                "tiempoLaborado": "3 año(s), 2 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Oportunidad laboral en otra constructora",
            }, {
                "empresa": "Vias y Puentes de Santander SAS", "pais": "Colombia", "departamento": "Santander", "ciudad": "Bucaramanga",
                "tipoEmpresa": "Privada", "proceso": "Construccion y Mantenimiento de Puentes", "jefeInmediato": "Sandra Milena Ortiz",
                "telEmpresa": "6076882233", "cargo": "Ingeniero de Proyectos Senior",
                "fechaInicio": "2021-06-01", "fechaTerminacion": "2023-06-01", "actual": False,
                "tiempoLaborado": "2 año(s), 0 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Cierre del proyecto asignado",
            }],
            {"tieneVinculo": "no", "familiares": [], "tieneOtraInhabilidad": "no", "descripcionInhabilidad": ""},
            {
                "celular": "3157778899",
                "cedula_de": "Bucaramanga", "fecha_nacimiento": "1988-12-02", "ciudad_nacimiento": "Bucaramanga",
                "depto_nacimiento": "Santander", "pais_nacimiento": "Colombia",
                "direccion": "Calle 36 # 20-14", "municipio": "Bucaramanga", "depto_residencia": "Santander",
                "tel_residencia": "6076332211", "estado_civil": "Divorciado(a)", "num_hijos": "1",
                "licencia": "si", "licencia_clase": "B1", "tiene_vehiculo": "si", "fecha_tarjeta": "2012-07-19",
            },
        ),
        (
            "Sofia Londono Marin", "1017777777", "sofia.londono.prueba@example.com", vac_auxiliar, "Auxiliar Administrativo",
            "CUMPLE (tiene la certificacion de Excel requerida)",
            [{
                "tipo": "certificacion", "nombreNorma": "Excel Avanzado", "numDocumento": "EXA-20231145",
                "fechaCertificado": "2023-08", "enteCertificador": "SENA",
            }, {
                "tipo": "certificacion", "nombreNorma": "Atencion al Cliente y Servicio", "numDocumento": "ACS-88213",
                "fechaCertificado": "2021-05", "enteCertificador": "Comfama",
            }],
            [{
                "empresa": "Almacen y Distribuciones JR SAS", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Medellin",
                "tipoEmpresa": "Privada", "proceso": "Servicio al Cliente y Facturacion", "jefeInmediato": "Jaime Ricardo Vasquez",
                "telEmpresa": "6042556677", "cargo": "Auxiliar de Servicio al Cliente",
                "fechaInicio": "2019-02-01", "fechaTerminacion": "2021-06-01", "actual": False,
                "tiempoLaborado": "2 año(s), 4 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Cierre de la sucursal",
            }, {
                "empresa": "Suministros y Papeleria del Centro SAS", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Medellin",
                "tipoEmpresa": "Privada", "proceso": "Gestion Documental y Compras", "jefeInmediato": "Luz Adriana Zapata",
                "telEmpresa": "6042998877", "cargo": "Auxiliar Administrativa",
                "fechaInicio": "2022-01-01", "fechaTerminacion": "2024-01-01", "actual": False,
                "tiempoLaborado": "2 año(s), 0 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Reestructuracion del area administrativa",
            }],
            {
                "tieneVinculo": "si", "familiares": [{"parentesco": "Hermano(a)", "nombreEmpleado": "Andres Londono Marin", "cargo": "Analista de Nomina"}],
                "tieneOtraInhabilidad": "no", "descripcionInhabilidad": "",
            },
            {
                "celular": "3213334455",
                "cedula_de": "Medellin", "fecha_nacimiento": "1997-10-11", "ciudad_nacimiento": "Medellin",
                "depto_nacimiento": "Antioquia", "pais_nacimiento": "Colombia",
                "direccion": "Calle 44 # 65-30", "municipio": "Medellin", "depto_residencia": "Antioquia",
                "tel_residencia": "6042774411", "estado_civil": "Soltero(a)", "num_hijos": "0",
                "licencia": "no", "licencia_clase": "", "tiene_vehiculo": "no", "fecha_tarjeta": "2023-04-02",
            },
        ),
        (
            "Esteban Marin Cardona", "1017888888", "esteban.marin.prueba@example.com", vac_tecnico, "Tecnico Operativo",
            "CUMPLE, ADEMAS DECLARA CONFLICTO DE INTERES",
            [{
                "tipo": "estudio", "nivelEducativo": "Tecnico", "titulo": "Tecnico en Mantenimiento",
                "establecimiento": "SENA - Regional Antioquia", "departamento": "Antioquia", "ciudad": "Bello",
                "graduado": "si", "inicio": "2015-01", "terminacion": "2016-12",
            }, {
                "tipo": "educacionTrabajo", "nombreEvento": "Curso de Seguridad Industrial y Trabajo en Alturas",
                "fechaCertificado": "2020-09", "numHoras": "40", "establecimiento": "Consejo Colombiano de Seguridad",
            }],
            [{
                "empresa": "Servicios Industriales Planta Norte SAS", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Bello",
                "tipoEmpresa": "Privada", "proceso": "Mantenimiento de Equipos Industriales", "jefeInmediato": "Fernando Alberto Gomez",
                "telEmpresa": "6044667788", "cargo": "Tecnico",
                "fechaInicio": "2021-01-01", "fechaTerminacion": "2024-01-01", "actual": False,
                "tiempoLaborado": "3 año(s), 0 mes(es), 0 día(s)", "dedicacion": "Tiempo completo",
                "motivoRetiro": "Busqueda de mejores oportunidades laborales",
            }],
            {
                "tieneVinculo": "si", "familiares": [{"parentesco": "Tio", "nombreEmpleado": "Roberto Marin", "cargo": "Supervisor de Planta"}],
                "tieneOtraInhabilidad": "si",
                "descripcionInhabilidad": "Es propietario de una ferreteria que en ocasiones provee repuestos menores a la planta donde labora.",
            },
            {
                "celular": "3502221199",
                "cedula_de": "Bello", "fecha_nacimiento": "1993-02-27", "ciudad_nacimiento": "Itagui",
                "depto_nacimiento": "Antioquia", "pais_nacimiento": "Colombia",
                "direccion": "Carrera 45 # 30-12", "municipio": "Bello", "depto_residencia": "Antioquia",
                "tel_residencia": "6044558899", "estado_civil": "Union libre", "num_hijos": "1",
                "licencia": "si", "licencia_clase": "A2", "tiene_vehiculo": "si", "fecha_tarjeta": "2018-09-25",
            },
        ),
    ]

    for nombre, cedula, correo, vacante_id, vacante_nombre, esperado, registros, experiencia, conflicto, datos_extra in candidatos:
        if not vacante_id:
            print(f"  Saltando a {nombre} (la vacante no se creo).")
            continue
        token_cand = registrar_y_login(nombre, correo, "ClavePrueba123!")
        if not token_cand:
            print(f"  No se pudo registrar/iniciar sesion con {nombre}.")
            continue
        profesion = next((r["titulo"] for r in registros if r.get("tipo") == "estudio" and r.get("titulo")), "Profesional")
        tarjeta = f"TP-{cedula[-6:]}"
        if not completar_perfil(token_cand, nombre, cedula, correo, registros, experiencia, conflicto, profesion, tarjeta, **datos_extra):
            continue
        radicado = inscribirme(token_cand, vacante_id)
        if radicado:
            print(f"  OK {nombre} -> {vacante_nombre} (radicado {radicado}) -- esperado: {esperado}")
            resumen.append((nombre, correo, vacante_nombre, radicado, esperado))

    print("\n=== Creando candidato con TODOS los campos llenos (para revisar PDF y reporte) ===\n")

    # Un registro de cada tipo del Registro II, con TODOS sus campos llenos
    # (incluye los que la mayoria de los otros candidatos deja vacios, para
    # que no aparezca ningun "-" al revisar el PDF/reporte).
    registros_completos = [
        {
            "tipo": "estudio", "nivelEducativo": "Postgrado", "titulo": "Especializacion en Analitica de Datos",
            "establecimiento": "Universidad EAFIT", "departamento": "Antioquia", "ciudad": "Medellin",
            "graduado": "si", "inicio": "2019-01", "terminacion": "2020-12",
        },
        {
            "tipo": "educacionTrabajo", "nombreEvento": "Diplomado en Gestion de Proyectos Agiles",
            "fechaCertificado": "2021-06", "numHoras": "120", "establecimiento": "Universidad EAFIT",
        },
        {
            "tipo": "certificacion", "nombreNorma": "Scrum Master Certified", "numDocumento": "SMC-88421",
            "fechaCertificado": "2022-03", "enteCertificador": "Scrum Alliance",
        },
        {
            "tipo": "idioma", "idioma": "Ingles", "establecimiento": "Centro Colombo Americano",
            "fecha": "2021-11", "nivel": "Avanzado",
        },
    ]

    # 2 experiencias laborales completas, sin "actual": True (ambas con fecha
    # de fin) y con tiempoLaborado ya calculado a mano — el formulario lo
    # calcula en el navegador, pero este script le pega directo a la API.
    experiencia_completa = [
        {
            "empresa": "Consultora Andina de Datos", "pais": "Colombia", "departamento": "Antioquia", "ciudad": "Medellin",
            "tipoEmpresa": "Privada", "proceso": "Analitica Avanzada", "jefeInmediato": "Patricia Gomez Uribe",
            "telEmpresa": "6043001122", "cargo": "Analista de Datos Junior",
            "fechaInicio": "2015-02-01", "fechaTerminacion": "2018-05-15", "actual": False,
            "tiempoLaborado": "3 año(s), 3 mes(es), 14 día(s)", "dedicacion": "Tiempo completo",
            "motivoRetiro": "Oportunidad de crecimiento profesional",
        },
        {
            "empresa": "Grupo Empresarial del Cauca", "pais": "Colombia", "departamento": "Valle del Cauca", "ciudad": "Cali",
            "tipoEmpresa": "Mixta", "proceso": "Business Intelligence", "jefeInmediato": "Carlos Andres Lopez",
            "telEmpresa": "6024455667", "cargo": "Especialista en Reportes y BI",
            "fechaInicio": "2018-06-01", "fechaTerminacion": "2023-09-30", "actual": False,
            "tiempoLaborado": "5 año(s), 3 mes(es), 29 día(s)", "dedicacion": "Tiempo completo",
            "motivoRetiro": "Reubicacion de residencia",
        },
    ]

    # tieneVinculo Y tieneOtraInhabilidad en "si" — a diferencia de los demas
    # candidatos, para que se vea tambien el bloque de descripcion en el PDF.
    conflicto_completo = {
        "tieneVinculo": "si",
        "familiares": [{"parentesco": "Prima", "nombreEmpleado": "Daniela Vargas Ortiz", "cargo": "Coordinadora de Compras"}],
        "tieneOtraInhabilidad": "si",
        "descripcionInhabilidad": "Es socia minoritaria de un proveedor externo que ocasionalmente presta servicios a la empresa.",
    }

    nombre_full = "Valentina Restrepo Zuluaga"
    correo_full = "valentina.restrepo.prueba@example.com"
    if not vac_completa:
        print(f"  Saltando a {nombre_full} (la vacante nueva no se creo).")
    else:
        token_cand_full = registrar_y_login(nombre_full, correo_full, "ClavePrueba123!")
        if not token_cand_full:
            print(f"  No se pudo registrar/iniciar sesion con {nombre_full}.")
        elif not completar_perfil(
            token_cand_full, nombre_full, "1020999888", correo_full,
            registros_completos, experiencia_completa, conflicto_completo,
            profesion="Ingeniera Industrial", tarjeta_profesional="TP-999888",
            celular="3157893421",
            cedula_de="Bogota D.C.", fecha_nacimiento="1990-03-22", ciudad_nacimiento="Cali", depto_nacimiento="Valle del Cauca",
            pais_nacimiento="Colombia", direccion="Calle 45 # 23-67 Apto 502", municipio="Envigado", depto_residencia="Antioquia",
            tel_residencia="6042223344", estado_civil="Casado(a)", num_hijos="2",
            licencia="si", licencia_clase="B1", tiene_vehiculo="si", fecha_tarjeta="2016-08-10",
        ):
            print(f"  No se pudo guardar el perfil completo de {nombre_full}.")
        else:
            radicado_full = inscribirme(token_cand_full, vac_completa)
            if radicado_full:
                print(f"  OK {nombre_full} -> Especialista en Datos y Reportes (radicado {radicado_full})")
                resumen.append((
                    nombre_full, correo_full, "Especialista en Datos y Reportes", radicado_full,
                    "TODOS LOS CAMPOS LLENOS -- para revisar el PDF y el reporte con datos completos",
                ))

    print("\n=== Listo ===")
    print(f"{len(resumen)} candidatos inscritos correctamente. Contrasena de todos: ClavePrueba123!\n")
    print(f"{'Candidato':<26} {'Vacante':<20} {'Radicado':<16} Resultado esperado")
    print("-" * 110)
    for nombre, correo, vacante_nombre, radicado, esperado in resumen:
        print(f"{nombre:<26} {vacante_nombre:<20} {radicado:<16} {esperado}")

    print("\nRevisalo en Gestion Humana -> Vacantes, Candidatos, o descarga el Reporte de cada vacante.")


if __name__ == "__main__":
    main()
