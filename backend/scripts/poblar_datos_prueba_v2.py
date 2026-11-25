#!/usr/bin/env python3
# ==============================================================
# scripts/poblar_datos_prueba_v2.py
#
# Segundo lote de datos de prueba: 5 vacantes NUEVAS y 11 candidatos
# NUEVOS, pensados para probar escenarios de evaluacion que el primer
# script no cubre:
#   - profesion_keyword (Derecho vs. otra carrera)
#   - graduado_requerido con candidato NO graduado
#   - certificaciones escritas distinto ("PowerBI" vs "Power BI")
#   - experiencias traslapadas (no se deben sumar dos veces)
#   - nivel de idioma por debajo / por encima del minimo
#   - nivel educativo insuficiente con mucha experiencia
#
# No toca los datos del primer script: usa procesos, correos y cedulas
# distintos. Se puede correr varias veces cambiando --lote.
#
# Uso (con los 3 backends arriba):
#   python scripts\poblar_datos_prueba_v2.py --admin-password TU_CLAVE
#   python scripts\poblar_datos_prueba_v2.py --admin-password TU_CLAVE --lote 3
#   (o define la variable de entorno ADMIN_PASSWORD y omite --admin-password)
# ==============================================================

import argparse
import os
import calendar
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

LOGIN = "http://localhost:9000"
VACANTES = "http://localhost:9001"
CANDIDATOS = "http://localhost:9002"

CLAVE_CANDIDATOS = "ClavePrueba123!"
HOY = date.today()


# --------------------------------------------------------------
# Utilidades (mismas del script original)
# --------------------------------------------------------------
def _tiempo_transcurrido(inicio: date, fin: date) -> str:
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
    except urllib.error.URLError as e:
        return 0, f"No hay conexion con {url} ({e.reason}). ¿Esta corriendo el servicio?"


def login(email, password):
    status, data = _req("POST", f"{LOGIN}/api/v1/auth/login", {"email": email, "password": password})
    if status != 200:
        if status == 0:
            print(f"  {data}")
        return None
    return data["access_token"]


_ULTIMO_REGISTRO = [0.0]


def registrar_y_login(nombre, email, password):
    # Limite de registro: 5 por minuto. Se espacian los intentos ~13 s.
    transcurrido = time.time() - _ULTIMO_REGISTRO[0]
    if transcurrido < 13:
        time.sleep(13 - transcurrido)

    intentos = 0
    while intentos < 6:
        status, _ = _req("POST", f"{LOGIN}/api/v1/auth/registro",
                         {"nombre_completo": nombre, "email": email, "password": password})
        _ULTIMO_REGISTRO[0] = time.time()
        if status == 429:
            intentos += 1
            print(f"  ⏳ Limite de registro alcanzado, esperando 15s antes de reintentar con {nombre}…")
            time.sleep(15)
            continue
        break
    # Si el correo ya existia (script corrido antes), el login igual funciona.
    return login(email, password)


def crear_vacante(token, **kwargs):
    status, data = _req("POST", f"{VACANTES}/api/v1/vacantes", kwargs, token)
    if status != 201:
        print(f"  ⚠️  No se pudo crear la vacante '{kwargs.get('cargo')}': {data}")
        return None
    return data["id"]


def _enums_de_estado(spec):
    """Valores posibles de 'estado' declarados en el OpenAPI del servicio."""
    valores = []

    def recorrer(nodo):
        if isinstance(nodo, dict):
            if "enum" in nodo:
                valores.extend(v for v in nodo["enum"] if isinstance(v, str))
            for v in nodo.values():
                recorrer(v)
        elif isinstance(nodo, list):
            for v in nodo:
                recorrer(v)

    recorrer(spec.get("components", {}))
    preferidos = [v for v in valores if any(k in v.lower() for k in ("abiert", "public", "activ"))]
    base = ["Abierta", "abierta", "Publicada", "publicada", "Activa", "activa"]
    return list(dict.fromkeys(preferidos + base))


def publicar_vacante(token, vacante_id):
    """Deja la vacante abierta/publicada para que los candidatos puedan inscribirse.
    Busca en el OpenAPI de modulo_vacantes un endpoint de publicar/estado y lo usa.
    Devuelve una descripcion de lo que hizo, o None si no encontro como."""
    status, spec = _req("GET", f"{VACANTES}/openapi.json")
    if status != 200 or not isinstance(spec, dict):
        return None
    estados = _enums_de_estado(spec)
    for path, metodos in spec.get("paths", {}).items():
        p = path.lower()
        if "{" not in path or not any(k in p for k in ("publicar", "abrir", "activar", "estado")):
            continue
        url = VACANTES + re.sub(r"\{[^}]+\}", vacante_id, path, count=1)
        for metodo in ("post", "patch", "put"):
            if metodo not in metodos:
                continue
            cuerpos = [None] + [{"estado": e} for e in estados]
            for cuerpo in cuerpos:
                st, _ = _req(metodo.upper(), url, cuerpo, token)
                if st in (200, 201, 204):
                    return f"{metodo.upper()} {path}" + (f" estado={cuerpo['estado']}" if cuerpo else "")
    # Ultimo intento: actualizar la vacante completa con estado abierto.
    for metodo in ("patch", "put"):
        for e in estados:
            st, _ = _req(metodo.upper(), f"{VACANTES}/api/v1/vacantes/{vacante_id}", {"estado": e}, token)
            if st in (200, 204):
                return f"{metodo.upper()} /api/v1/vacantes/{{id}} estado={e}"
    return None


_DIAGNOSTICO_MOSTRADO = [False]


def diagnosticar_inscripcion(token_admin, vacante_id):
    """Si la inscripcion falla, muestra (una sola vez) la informacion necesaria
    para saber por que: como quedo la vacante y el codigo que lanza el error."""
    if _DIAGNOSTICO_MOSTRADO[0]:
        return
    _DIAGNOSTICO_MOSTRADO[0] = True
    print("\n  ----- DIAGNOSTICO (copia y pega esto) -----")
    st, vac = _req("GET", f"{VACANTES}/api/v1/vacantes/{vacante_id}", token=token_admin)
    if isinstance(vac, dict):
        resumen = {k: v for k, v in vac.items() if k in ("id", "proceso_no", "estado", "fecha_apertura", "fecha_cierre", "hora_cierre", "publicada", "activa")}
        print(f"  Vacante en modulo_vacantes (HTTP {st}): {resumen}")
    else:
        print(f"  GET vacante en modulo_vacantes -> HTTP {st}: {str(vac)[:200]}")
    carpeta = Path(__file__).resolve().parent.parent / "modulo_candidatos" / "app"
    for archivo in carpeta.rglob("*.py"):
        lineas = archivo.read_text(encoding="utf-8", errors="ignore").splitlines()
        for n, linea in enumerate(lineas):
            if "No existe una vacante" in linea:
                ini = max(0, n - 25)
                print(f"  Codigo en {archivo.relative_to(carpeta.parent)} (lineas {ini + 1}-{n + 1}):")
                for j in range(ini, n + 1):
                    print(f"    {j + 1:4}| {lineas[j]}")
    print("  -------------------------------------------\n")


def documentos_dummy():
    doc = {"nombre": "documento.pdf", "contenido_base64": "JVBERi0xLjQ="}
    return {"cedula": [doc], "certificados_laborales": [doc], "certificados_estudio": [doc], "tarjeta_profesional": [doc]}


def completar_perfil(token, nombre_completo, cedula, correo, registros_ii, experiencia, conflicto,
                     profesion, tarjeta_profesional, datos):
    body = {
        "datos_personales": {
            "nombreCompleto": nombre_completo, "cedula": cedula, "cedulaDe": datos["cedula_de"],
            "fechaNacimiento": datos["fecha_nacimiento"], "ciudadNacimiento": datos["ciudad_nacimiento"],
            "deptoNacimiento": datos["depto_nacimiento"], "paisNacimiento": "Colombia",
            "correo": correo, "direccion": datos["direccion"], "municipio": datos["municipio"],
            "deptoResidencia": datos["depto_residencia"], "telResidencia": datos["tel_residencia"],
            "celular": datos["celular"], "estadoCivil": datos["estado_civil"], "numHijos": datos["num_hijos"],
            "licencia": datos["licencia"], "licenciaClase": datos["licencia_clase"],
            "tieneVehiculo": datos["tiene_vehiculo"], "tarjetaProfesional": tarjeta_profesional,
            "profesion": profesion, "fechaTarjeta": datos["fecha_tarjeta"],
        },
        "registros_ii": registros_ii,
        "experiencia": experiencia,
        "conflicto": conflicto,
        "documentos_adjuntos": documentos_dummy(),
        "autorizacion": {"acepta": True, "nombre_completo": nombre_completo},
    }
    status, data = _req("PUT", f"{CANDIDATOS}/api/v1/perfiles/me", body, token)
    if status != 200:
        print(f"  ⚠️  No se pudo guardar el perfil de {nombre_completo}: {data}")
        return False
    return True


def inscribirme(token, vacante_id):
    status, data = _req("POST", f"{CANDIDATOS}/api/v1/solicitudes/inscribirme", {"vacante_id": vacante_id}, token)
    if status != 201:
        print(f"  ⚠️  No se pudo inscribir: {data}")
        return None
    return data["radicado"]


# --------------------------------------------------------------
# Constructores para no repetir campos
# --------------------------------------------------------------
def estudio(nivel, titulo, establecimiento, ciudad, depto, inicio, fin, graduado="si"):
    return {"tipo": "estudio", "nivelEducativo": nivel, "titulo": titulo, "establecimiento": establecimiento,
            "departamento": depto, "ciudad": ciudad, "graduado": graduado, "inicio": inicio, "terminacion": fin}


def certificacion(nombre, num, fecha, ente):
    return {"tipo": "certificacion", "nombreNorma": nombre, "numDocumento": num,
            "fechaCertificado": fecha, "enteCertificador": ente}


def idioma(nombre, nivel, establecimiento, fecha):
    return {"tipo": "idioma", "idioma": nombre, "establecimiento": establecimiento, "fecha": fecha, "nivel": nivel}


def curso(nombre, fecha, horas, establecimiento):
    return {"tipo": "educacionTrabajo", "nombreEvento": nombre, "fechaCertificado": fecha,
            "numHoras": str(horas), "establecimiento": establecimiento}


def exp(empresa, ciudad, depto, tipo, proceso, jefe, tel, cargo, inicio, fin=None,
        dedicacion="Tiempo completo", motivo=""):
    """Experiencia laboral. Si fin es None, es el empleo actual.
    El tiempoLaborado se calcula solo, a partir de las fechas."""
    f_ini = date.fromisoformat(inicio)
    f_fin = date.fromisoformat(fin) if fin else HOY
    e = {"empresa": empresa, "pais": "Colombia", "departamento": depto, "ciudad": ciudad,
         "tipoEmpresa": tipo, "proceso": proceso, "jefeInmediato": jefe, "telEmpresa": tel, "cargo": cargo,
         "fechaInicio": inicio, "actual": fin is None,
         "tiempoLaborado": _tiempo_transcurrido(f_ini, f_fin), "dedicacion": dedicacion}
    if fin:
        e["fechaTerminacion"] = fin
        e["motivoRetiro"] = motivo
    return e


def sin_conflicto():
    return {"tieneVinculo": "no", "familiares": [], "tieneOtraInhabilidad": "no", "descripcionInhabilidad": ""}


def con_familiar(parentesco, nombre, cargo, inhabilidad=""):
    return {"tieneVinculo": "si", "familiares": [{"parentesco": parentesco, "nombreEmpleado": nombre, "cargo": cargo}],
            "tieneOtraInhabilidad": "si" if inhabilidad else "no", "descripcionInhabilidad": inhabilidad}


def personales(celular, cedula_de, nacimiento, ciudad_nac, depto_nac, direccion, municipio, depto_res,
               tel, estado_civil="Soltero(a)", hijos="0", licencia="no", clase="", vehiculo="no",
               fecha_tarjeta="2020-01-01"):
    return {"celular": celular, "cedula_de": cedula_de, "fecha_nacimiento": nacimiento,
            "ciudad_nacimiento": ciudad_nac, "depto_nacimiento": depto_nac, "direccion": direccion,
            "municipio": municipio, "depto_residencia": depto_res, "tel_residencia": tel,
            "estado_civil": estado_civil, "num_hijos": hijos, "licencia": licencia, "licencia_clase": clase,
            "tiene_vehiculo": vehiculo, "fecha_tarjeta": fecha_tarjeta}


# --------------------------------------------------------------
# Script principal
# --------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Poblar datos de prueba v2 (vacantes y candidatos nuevos)")
    parser.add_argument("--admin-email", default="admin@aguasnacionalesepm.com")
    # Sin contraseña escrita en el código: el repositorio es público.
    parser.add_argument("--admin-password", default=os.environ.get("ADMIN_PASSWORD"),
                        help="Clave del admin (o la variable de entorno ADMIN_PASSWORD).")
    parser.add_argument("--lote", type=int, default=2,
                        help="Numero de lote (2-99). Cambialo para crear otra tanda sin repetir correos, cedulas ni procesos.")
    args = parser.parse_args()
    if not args.admin_password:
        parser.error("falta la clave del admin: usa --admin-password TU_CLAVE o define ADMIN_PASSWORD")
    lote = args.lote

    print(f"=== Lote {lote} — iniciando sesion como admin ===")
    token_admin = login(args.admin_email, args.admin_password)
    if not token_admin:
        print(f"No se pudo iniciar sesion con {args.admin_email}.")
        print("   Revisa que modulo_login (puerto 9000) este corriendo y que la contrasena sea la correcta:")
        print("   python scripts\\poblar_datos_prueba_v2.py --admin-password TU_CLAVE")
        sys.exit(1)
    print("Sesion de admin iniciada.\n")

    apertura = HOY.isoformat()
    cierre = (HOY + timedelta(days=30)).isoformat()

    def proceso(n):
        return f"2026-P{lote:02d}-{n:02d}"

    print("=== Creando vacantes ===")

    vac_juridico = crear_vacante(
        token_admin,
        proceso_no=proceso(1), cargo="Profesional Juridico de Contratacion",
        descripcion="Acompanamiento juridico a los procesos de contratacion de obras y consultorias de la Direccion de Proyectos.",
        area="Juridica", sede="Medellin", plazas=1,
        salario="5.400.000", tipo_vinculacion="Término indefinido", publico_objetivo="Externo",
        fecha_apertura=apertura, fecha_cierre=cierre, hora_cierre="17:00",
        requisitos_obligatorios="Titulo profesional en Derecho y tarjeta profesional vigente.",
        conocimientos_complementarios="Ley 80 de 1993, Ley 1150 de 2007 y regimen de contratacion de empresas de servicios publicos.",
        criterios={"nivel_educativo_min": "Universitario", "graduado_requerido": True,
                   "profesion_keyword": "derecho", "experiencia_min_anios": 3},
    )
    print(f"  Profesional Juridico (Universitario + Derecho + 3 anios) -> {vac_juridico}")

    vac_bi = crear_vacante(
        token_admin,
        proceso_no=proceso(2), cargo="Analista de Inteligencia de Negocios",
        descripcion="Construccion de tableros de seguimiento de proyectos e indicadores operativos.",
        area="Tecnologia e Innovacion", sede="Medellin", plazas=2,
        salario="4.300.000", tipo_vinculacion="Término fijo", publico_objetivo="Ambos",
        fecha_apertura=apertura, fecha_cierre=cierre, hora_cierre="17:00",
        requisitos_obligatorios="Experiencia construyendo tableros en Power BI con fuentes SQL.",
        conocimientos_complementarios="DAX, Power Query, modelado dimensional y SQL Server.",
        criterios={"nivel_educativo_min": "Universitario", "experiencia_min_anios": 2,
                   "certificaciones_keywords": ["Power BI", "SQL"]},
    )
    print(f"  Analista de Inteligencia de Negocios (certificaciones Power BI + SQL) -> {vac_bi}")

    vac_sst = crear_vacante(
        token_admin,
        proceso_no=proceso(3), cargo="Coordinador de Seguridad y Salud en el Trabajo",
        descripcion="Coordinacion del SG-SST en frentes de obra y plantas de tratamiento.",
        area="Gestion Humana", sede="Bello", plazas=1,
        salario="5.100.000", tipo_vinculacion="Término indefinido", publico_objetivo="Externo",
        fecha_apertura=apertura, fecha_cierre=cierre, hora_cierre="16:30",
        requisitos_obligatorios="Licencia en SST vigente y disponibilidad para desplazarse a frentes de obra.",
        conocimientos_complementarios="Decreto 1072 de 2015, Resolucion 0312 de 2019, investigacion de incidentes.",
        criterios={"nivel_educativo_min": "Universitario", "graduado_requerido": True,
                   "experiencia_min_anios": 4, "certificaciones_keywords": ["SST"]},
    )
    print(f"  Coordinador SST (Universitario + 4 anios + certificacion SST) -> {vac_sst}")

    vac_practicante = crear_vacante(
        token_admin,
        proceso_no=proceso(4), cargo="Practicante de Ingenieria Civil",
        descripcion="Practica academica de un semestre apoyando la interventoria de obras de acueducto.",
        area="Ingenieria", sede="Medellin", plazas=3,
        salario="1.750.000", tipo_vinculacion="Término fijo", publico_objetivo="Externo",
        fecha_apertura=apertura, fecha_cierre=cierre, hora_cierre="12:00",
        requisitos_obligatorios="Estar matriculado en los ultimos semestres de Ingenieria Civil.",
        conocimientos_complementarios="AutoCAD, Excel y lectura de planos.",
        criterios={},
    )
    print(f"  Practicante de Ingenieria Civil (sin criterios) -> {vac_practicante}")

    vac_hidraulico = crear_vacante(
        token_admin,
        proceso_no=proceso(5), cargo="Lider de Proyectos Hidraulicos",
        descripcion="Liderazgo tecnico de proyectos de redes de acueducto y alcantarillado financiados con banca multilateral.",
        area="Ingenieria", sede="Medellin", plazas=1,
        salario="11.200.000", tipo_vinculacion="Término indefinido", publico_objetivo="Ambos",
        fecha_apertura=apertura, fecha_cierre=cierre, hora_cierre="18:00",
        requisitos_obligatorios="Posgrado en recursos hidraulicos o afines, ingles avanzado para interlocucion con la banca.",
        conocimientos_complementarios="EPANET, SewerGEMS, normas RAS y gestion de proyectos (PMI).",
        criterios={"nivel_educativo_min": "Postgrado", "graduado_requerido": True, "experiencia_min_anios": 6,
                   "idioma_requerido": "Ingles", "idioma_nivel_min": "Avanzado"},
    )
    print(f"  Lider de Proyectos Hidraulicos (Postgrado + 6 anios + ingles Avanzado) -> {vac_hidraulico}\n")

    print("=== Publicando / abriendo vacantes ===")
    for vid in (vac_juridico, vac_bi, vac_sst, vac_practicante, vac_hidraulico):
        if vid:
            hecho = publicar_vacante(token_admin, vid)
            print(f"  {vid} -> {hecho or 'no se encontro endpoint de publicacion (se intenta inscribir igual)'}")
    print()

    # ----------------------------------------------------------
    # Candidatos: (nombre, correo_base, vacante_id, vacante_nombre, esperado,
    #              registros_ii, experiencia, conflicto, datos_personales)
    # ----------------------------------------------------------
    candidatos = [
        # ---------- Profesional Juridico ----------
        (
            "Natalia Herrera Gil", "natalia.herrera", vac_juridico, "Prof. Juridico",
            "CUMPLE TODO (Derecho + graduada + 4 anios)",
            [estudio("Universitario", "Derecho", "Universidad de Medellin", "Medellin", "Antioquia", "2011-01", "2016-06"),
             curso("Diplomado en Contratacion Estatal", "2018-10", 120, "Universidad Pontificia Bolivariana")],
            [exp("Gomez & Asociados Abogados", "Medellin", "Antioquia", "Privada", "Derecho Administrativo",
                 "Beatriz Elena Gomez", "6043114455", "Abogada Junior", "2017-02-01", "2019-08-31",
                 motivo="Oferta en el sector publico"),
             exp("Empresa de Desarrollo Urbano", "Medellin", "Antioquia", "Publica", "Gestion Contractual",
                 "Oscar Mauricio Rios", "6043857700", "Abogada de Contratos", "2019-09-15", "2021-06-30",
                 motivo="Finalizacion de contrato de prestacion de servicios")],
            sin_conflicto(),
            personales("3014567812", "Medellin", "1993-04-09", "Medellin", "Antioquia", "Calle 10 Sur # 43-21",
                       "Medellin", "Antioquia", "6043124567", fecha_tarjeta="2016-09-20"),
        ),
        (
            "Santiago Mejia Arango", "santiago.mejia", vac_juridico, "Prof. Juridico",
            "NO CUMPLE PROFESION (Administrador, no abogado)",
            [estudio("Universitario", "Administracion de Empresas", "Universidad EAFIT", "Medellin", "Antioquia", "2009-01", "2013-12")],
            [exp("Constructora Horizonte SAS", "Envigado", "Antioquia", "Privada", "Compras y Contratacion",
                 "Luis Fernando Arango", "6043318899", "Analista de Compras", "2014-03-01", "2019-12-31",
                 motivo="Cambio de ciudad de la empresa"),
             exp("Inversiones del Valle de Aburra", "Medellin", "Antioquia", "Privada", "Administracion de Contratos",
                 "Claudia Patricia Mesa", "6044447788", "Administrador de Contratos", "2020-02-01")],
            sin_conflicto(),
            personales("3127894561", "Envigado", "1990-11-23", "Envigado", "Antioquia", "Carrera 43A # 38 Sur-15",
                       "Envigado", "Antioquia", "6043345566", "Casado(a)", "1", "si", "B1", "si", "2014-02-11"),
        ),
        (
            "Paula Andrea Cardenas Rios", "paula.cardenas", vac_juridico, "Prof. Juridico",
            "NO CUMPLE (Derecho pero NO graduada)",
            [estudio("Universitario", "Derecho", "Universidad de Antioquia", "Medellin", "Antioquia", "2015-01", "2026-12", graduado="no")],
            [exp("Consultorio Juridico Universidad de Antioquia", "Medellin", "Antioquia", "Publica", "Asesoria Juridica Gratuita",
                 "Hernando de Jesus Palacio", "6042198800", "Asistente Juridica", "2021-01-15", "2024-07-15",
                 dedicacion="Medio tiempo", motivo="Fin del periodo de consultorio")],
            sin_conflicto(),
            personales("3208881234", "Medellin", "1998-06-17", "Rionegro", "Antioquia", "Calle 50 # 80-12",
                       "Medellin", "Antioquia", "6042567788", fecha_tarjeta="2024-01-01"),
        ),

        # ---------- Analista BI ----------
        (
            "Felipe Ochoa Rendon", "felipe.ochoa", vac_bi, "Analista BI",
            "CUMPLE (escribe 'PowerBI' pegado: prueba el ventaneo de palabras)",
            [estudio("Universitario", "Ingenieria de Sistemas", "Universidad Catolica Luis Amigo", "Medellin", "Antioquia", "2014-01", "2019-06"),
             certificacion("Microsoft Certified: PowerBI Data Analyst Associate", "PL300-551203", "2023-05", "Microsoft"),
             certificacion("SQL Server Querying Fundamentals", "SQL-77410", "2022-02", "Platzi"),
             idioma("Ingles", "Intermedio", "Politecnico Colombiano JIC", "2020-08")],
            [exp("Retail Analitica SAS", "Medellin", "Antioquia", "Privada", "Inteligencia Comercial",
                 "Juliana Maria Posada", "6045119900", "Analista de Datos", "2019-08-01", "2022-10-31",
                 motivo="Mejor oferta salarial"),
             exp("Logistica Integral de Colombia", "Itagui", "Antioquia", "Privada", "Analitica Operacional",
                 "Camilo Andres Velez", "6043779911", "Desarrollador BI", "2022-11-15")],
            sin_conflicto(),
            personales("3045556789", "Medellin", "1996-02-12", "Medellin", "Antioquia", "Carrera 70 # 44-21 Apto 301",
                       "Medellin", "Antioquia", "6044129988", "Union libre", "0", "si", "A2", "si", "2019-10-01"),
        ),
        (
            "Luisa Fernanda Cano Duque", "luisa.cano", vac_bi, "Analista BI",
            "NO CUMPLE CERTIFICACIONES (solo tiene Excel)",
            [estudio("Universitario", "Ingenieria Industrial", "Universidad Nacional de Colombia", "Medellin", "Antioquia", "2013-01", "2018-06"),
             certificacion("Excel Avanzado y Macros", "EXM-30912", "2020-03", "SENA")],
            [exp("Textiles del Norte SA", "Bello", "Antioquia", "Privada", "Planeacion de la Produccion",
                 "Gloria Ines Arboleda", "6044526677", "Analista de Planeacion", "2018-08-01", "2023-03-31",
                 motivo="Renuncia voluntaria")],
            sin_conflicto(),
            personales("3116667890", "Bello", "1995-09-30", "Bello", "Antioquia", "Diagonal 55 # 34-80",
                       "Bello", "Antioquia", "6044523311", fecha_tarjeta="2018-11-05"),
        ),

        # ---------- Coordinador SST ----------
        (
            "Jorge Ivan Quintero Soto", "jorge.quintero", vac_sst, "Coordinador SST",
            "NO CUMPLE EXPERIENCIA (5,5 anios sumados pero TRASLAPADOS = 3,5 reales)",
            [estudio("Universitario", "Administracion en Salud Ocupacional", "Politecnico Grancolombiano", "Medellin", "Antioquia", "2014-01", "2018-12"),
             certificacion("Curso de 50 horas del Sistema de Gestion SST", "SST50-22871", "2019-11", "ARL Sura")],
            # Dos trabajos al mismo tiempo: el sistema NO debe sumarlos dos veces.
            [exp("Obras Civiles del Oriente SAS", "Rionegro", "Antioquia", "Privada", "Seguridad y Salud en el Trabajo",
                 "Mauricio Alejandro Henao", "6045318822", "Inspector SST", "2020-01-01", "2023-07-01",
                 motivo="Finalizacion de la obra"),
             exp("Asesorias Preventivas SAS", "Rionegro", "Antioquia", "Privada", "Consultoria en SST",
                 "Liliana Maria Zapata", "6045314466", "Asesor SST", "2021-01-01", "2023-01-01",
                 dedicacion="Medio tiempo", motivo="Terminacion del contrato de asesoria")],
            sin_conflicto(),
            personales("3172223344", "Rionegro", "1992-12-08", "Marinilla", "Antioquia", "Calle 49 # 52-30",
                       "Rionegro", "Antioquia", "6045312233", "Casado(a)", "2", "si", "B1", "si", "2019-02-14"),
        ),
        (
            "Adriana Patino Lopera", "adriana.patino", vac_sst, "Coordinador SST",
            "CUMPLE TODO (6 anios + certificacion SST) y declara familiar",
            [estudio("Universitario", "Ingenieria Industrial", "Universidad de Medellin", "Medellin", "Antioquia", "2010-01", "2014-12"),
             estudio("Postgrado", "Especializacion en Seguridad y Salud en el Trabajo", "Universidad CES", "Medellin", "Antioquia", "2016-01", "2016-12"),
             certificacion("Auditor Interno SST ISO 45001", "ISO45-11987", "2021-04", "ICONTEC"),
             curso("Coordinador de Trabajo Seguro en Alturas", "2022-08", 80, "SENA")],
            [exp("Cementos del Occidente SA", "Medellin", "Antioquia", "Privada", "Seguridad Industrial",
                 "Ramiro Antonio Velasquez", "6043608800", "Profesional SST", "2017-02-01", "2021-01-31",
                 motivo="Oportunidad de ascenso en otra empresa"),
             exp("Vias Antioquenas SAS", "Bello", "Antioquia", "Privada", "Gestion HSEQ",
                 "Natalia Cristina Ospina", "6044882200", "Coordinadora HSEQ", "2021-03-01")],
            con_familiar("Primo(a)", "Carlos Mario Patino", "Tecnico de Mantenimiento"),
            personales("3009991122", "Medellin", "1991-07-25", "Medellin", "Antioquia", "Carrera 80 # 32-15",
                       "Medellin", "Antioquia", "6043431122", "Soltero(a)", "1", "si", "B1", "no", "2015-03-02"),
        ),

        # ---------- Practicante ----------
        (
            "Tomas Villa Echeverri", "tomas.villa", vac_practicante, "Practicante",
            "CUMPLE (sin criterios, estudiante en curso)",
            [estudio("Universitario", "Ingenieria Civil", "Universidad EIA", "Envigado", "Antioquia", "2022-01", "2027-06", graduado="no"),
             curso("AutoCAD 2D y 3D", "2024-03", 60, "SENA")],
            [exp("Monitorias Academicas EIA", "Envigado", "Antioquia", "Privada", "Docencia",
                 "Andrea Carolina Mejia", "6043549090", "Monitor de Topografia", "2025-02-01", "2025-11-30",
                 dedicacion="Medio tiempo", motivo="Fin del semestre academico")],
            sin_conflicto(),
            personales("3136660011", "Envigado", "2003-05-14", "Envigado", "Antioquia", "Calle 37 Sur # 27-40",
                       "Envigado", "Antioquia", "6043311100", fecha_tarjeta="2025-01-01"),
        ),

        # ---------- Lider Hidraulico ----------
        (
            "Catalina Montoya Arbelaez", "catalina.montoya", vac_hidraulico, "Lider Hidraulico",
            "CUMPLE TODO (Maestria + 9 anios + ingles Experto, por encima del minimo)",
            [estudio("Universitario", "Ingenieria Civil", "Universidad Nacional de Colombia", "Medellin", "Antioquia", "2005-01", "2010-06"),
             estudio("Postgrado", "Maestria en Recursos Hidraulicos", "Universidad Nacional de Colombia", "Medellin", "Antioquia", "2012-01", "2014-06"),
             certificacion("PMP - Project Management Professional", "PMP-3310245", "2020-10", "Project Management Institute"),
             idioma("Ingles", "Experto", "Universidad de Toronto", "2015-12")],
            [exp("Hidroestudios Consultores SAS", "Medellin", "Antioquia", "Privada", "Modelacion Hidraulica",
                 "Alvaro Jose Restrepo", "6042667700", "Ingeniera Hidraulica", "2014-08-01", "2019-12-31",
                 motivo="Oferta internacional"),
             exp("Water Engineering Group", "Bogota D.C.", "Bogota D.C.", "Privada", "Proyectos de Acueducto",
                 "Michael Anderson", "6017443322", "Gerente de Proyecto", "2020-02-01")],
            sin_conflicto(),
            personales("3182224455", "Medellin", "1987-01-19", "Manizales", "Caldas", "Carrera 25 # 1A Sur-155",
                       "Medellin", "Antioquia", "6043126655", "Casado(a)", "2", "si", "B1", "si", "2010-09-10"),
        ),
        (
            "Ricardo Salcedo Pineda", "ricardo.salcedo", vac_hidraulico, "Lider Hidraulico",
            "NO CUMPLE IDIOMA (ingles Intermedio, pide Avanzado)",
            [estudio("Universitario", "Ingenieria Sanitaria", "Universidad de Antioquia", "Medellin", "Antioquia", "2004-01", "2009-06"),
             estudio("Postgrado", "Especializacion en Gerencia de Proyectos", "Universidad EAFIT", "Medellin", "Antioquia", "2013-01", "2013-12"),
             idioma("Ingles", "Intermedio", "Centro Colombo Americano", "2014-06")],
            [exp("Acueductos Rurales de Antioquia", "Santa Fe de Antioquia", "Antioquia", "Mixta", "Diseno de Redes",
                 "Gilberto Antonio Rua", "6048531122", "Ingeniero de Diseno", "2010-01-01", "2016-12-31",
                 motivo="Liquidacion de la entidad"),
             exp("Consorcio Redes del Sur", "Itagui", "Antioquia", "Privada", "Construccion de Alcantarillado",
                 "Diana Patricia Munoz", "6043720011", "Director de Obra", "2017-03-01", "2025-02-28",
                 motivo="Terminacion del consorcio")],
            sin_conflicto(),
            personales("3104443322", "Itagui", "1985-08-03", "Itagui", "Antioquia", "Calle 52 # 48-60",
                       "Itagui", "Antioquia", "6043775544", "Divorciado(a)", "1", "si", "C1", "si", "2009-10-22"),
        ),
        (
            "Daniela Giraldo Botero", "daniela.giraldo", vac_hidraulico, "Lider Hidraulico",
            "NO CUMPLE NIVEL EDUCATIVO (Universitario, pide Postgrado) aunque tiene 10+ anios",
            [estudio("Universitario", "Ingenieria Civil", "Universidad de Medellin", "Medellin", "Antioquia", "2006-01", "2010-12"),
             idioma("Ingles", "Avanzado", "EF Education First", "2016-02")],
            [exp("Constructora Capital Andina", "Medellin", "Antioquia", "Privada", "Obras Hidraulicas",
                 "Pedro Nel Ospina", "6044119988", "Residente de Obra", "2011-02-01", "2017-06-30",
                 motivo="Cierre de la division de obras"),
             exp("Interventorias Tecnicas SAS", "Medellin", "Antioquia", "Privada", "Interventoria de Acueductos",
                 "Maria Victoria Correa", "6042338877", "Coordinadora de Interventoria", "2017-08-01")],
            con_familiar("Hermano(a)", "Alejandro Giraldo Botero", "Analista Financiero",
                         "Su esposo es contratista de obra civil en proyectos de la empresa."),
            personales("3015552211", "Medellin", "1988-03-27", "Pereira", "Risaralda", "Circular 4 # 70-22",
                       "Medellin", "Antioquia", "6044113322", "Casado(a)", "3", "si", "B1", "si", "2011-01-17"),
        ),
    ]

    print(f"=== Creando {len(candidatos)} candidatos e inscribiendolos ===")
    print("    (tarda unos 2-3 minutos por el limite de registros por minuto)\n")
    resumen = []

    for i, (nombre, correo_base, vacante_id, vacante_nombre, esperado,
            registros, experiencia, conflicto, datos) in enumerate(candidatos, start=1):
        if not vacante_id:
            print(f"  Saltando a {nombre} (la vacante no se creo).")
            continue
        correo = f"{correo_base}.prueba{lote}@example.com"
        cedula = f"10{lote:02d}{900000 + i}"
        token = registrar_y_login(nombre, correo, CLAVE_CANDIDATOS)
        if not token:
            print(f"  No se pudo registrar/iniciar sesion con {nombre}.")
            continue
        profesion = next((r["titulo"] for r in registros if r.get("tipo") == "estudio"), "Profesional")
        tarjeta = f"TP-{cedula[-6:]}"
        if not completar_perfil(token, nombre, cedula, correo, registros, experiencia, conflicto, profesion, tarjeta, datos):
            continue
        radicado = inscribirme(token, vacante_id)
        if radicado:
            print(f"  OK {nombre} -> {vacante_nombre} (radicado {radicado})")
            resumen.append((nombre, correo, vacante_nombre, radicado, esperado))
        else:
            diagnosticar_inscripcion(token_admin, vacante_id)

    print("\n=== Listo ===")
    print(f"{len(resumen)} candidatos inscritos. Contrasena de todos: {CLAVE_CANDIDATOS}\n")
    print(f"{'Candidato':<30} {'Vacante':<18} {'Radicado':<16} Resultado esperado")
    print("-" * 130)
    for nombre, correo, vacante_nombre, radicado, esperado in resumen:
        print(f"{nombre:<30} {vacante_nombre:<18} {radicado:<16} {esperado}")
    print("\nCorreos de acceso:")
    for nombre, correo, *_ in resumen:
        print(f"  {nombre:<30} {correo}")

    print("\nRevisalo en Gestion Humana -> Procesos de Seleccion, o descarga el Reporte de cada vacante.")


if __name__ == "__main__":
    main()
