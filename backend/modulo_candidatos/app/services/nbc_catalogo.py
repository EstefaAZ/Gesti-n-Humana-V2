# ==============================================================
# modulo_candidatos / app/services/nbc_catalogo.py
#
# Núcleos Básicos del Conocimiento (NBC) — clasificación oficial del
# Ministerio de Educación (SNIES) que usa Gestión Humana para decidir qué
# títulos son "afines". Códigos y nombres según el anexo de la Resolución
# ICFES 395 de 2018. Se omiten los núcleos "Sin clasificar" y "Normales
# superiores", que no sirven para comparar afinidad.
#
# Un título se reconoce por palabras clave. Si una palabra clave de varias
# palabras coincide ("medicina veterinaria"), gana sobre las de menos
# palabras ("medicina"): así un título cae en su núcleo más específico.
# ==============================================================

from app.services.coincidencia_texto import _texto_incluye_keyword, _tokens

AREAS = {
    "1": "Agronomía, veterinaria y afines",
    "2": "Bellas artes",
    "3": "Ciencias de la educación",
    "4": "Ciencias de la salud",
    "5": "Ciencias sociales y humanas",
    "6": "Economía, administración, contaduría y afines",
    "8": "Ingeniería, arquitectura, urbanismo y afines",
    "9": "Matemáticas y ciencias naturales",
}

# (código, nombre, código de área, palabras clave que lo reconocen en un título)
_NUCLEOS = [
    ("11", "Agronomía", "1", ["agronomia", "agronomo", "produccion agricola"]),
    ("12", "Zootecnia", "1", ["zootecnia", "zootecnista"]),
    ("13", "Medicina veterinaria", "1", ["medicina veterinaria", "veterinaria", "veterinario"]),

    ("24", "Artes plásticas, visuales y afines", "2", ["artes plasticas", "artes visuales", "bellas artes", "fotografia"]),
    ("25", "Artes representativas", "2", ["teatro", "danza", "artes escenicas", "arte dramatico", "actuacion"]),
    ("26", "Publicidad y afines", "2", ["publicidad", "publicista"]),
    ("27", "Diseño", "2", ["diseño", "diseño grafico", "diseño industrial", "diseño de modas", "diseño visual", "animacion digital"]),
    ("28", "Música", "2", ["musica", "musico"]),
    ("270", "Otros programas asociados a bellas artes", "2", ["cine", "artes audiovisuales", "realizacion audiovisual", "produccion audiovisual"]),

    ("313", "Educación", "3", ["licenciatura", "licenciado", "licenciada", "pedagogia", "pedagogo", "docencia", "educacion preescolar", "educacion basica"]),

    ("440", "Bacteriología", "4", ["bacteriologia", "bacteriologo", "laboratorio clinico"]),
    ("441", "Enfermería", "4", ["enfermeria", "enfermero", "enfermera"]),
    ("444", "Instrumentación quirúrgica", "4", ["instrumentacion quirurgica", "instrumentador quirurgico"]),
    ("445", "Medicina", "4", ["medicina", "medico", "medica"]),
    ("446", "Nutrición y dietética", "4", ["nutricion", "dietetica", "nutricionista"]),
    ("447", "Odontología", "4", ["odontologia", "odontologo", "salud oral"]),
    ("448", "Optometría, otros programas de ciencias de la salud", "4", ["optometria", "optometra", "regencia farmacia", "atencion prehospitalaria", "radiologia", "imagenes diagnosticas", "gerontologia"]),
    ("450", "Salud pública", "4", ["salud publica", "salud ocupacional", "seguridad salud trabajo", "administracion salud"]),
    ("442", "Terapias", "4", ["fisioterapia", "fisioterapeuta", "terapia ocupacional", "terapia respiratoria", "fonoaudiologia"]),

    ("553", "Antropología, artes liberales", "5", ["antropologia", "antropologo", "artes liberales"]),
    ("555", "Bibliotecología, otros de ciencias sociales y humanas", "5", ["bibliotecologia", "archivistica", "gestion documental", "ciencias informacion"]),
    ("556", "Ciencia política, relaciones internacionales", "5", ["ciencia politica", "ciencias politicas", "relaciones internacionales", "politologo"]),
    ("557", "Comunicación social, periodismo y afines", "5", ["comunicacion social", "periodismo", "periodista", "comunicacion", "comunicador", "comunicacion organizacional"]),
    ("558", "Deportes, educación física y recreación", "5", ["deporte", "deportes", "educacion fisica", "recreacion", "entrenamiento deportivo"]),
    ("559", "Derecho y afines", "5", ["derecho", "abogado", "abogada", "ciencias juridicas"]),
    ("568", "Filosofía, teología y afines", "5", ["filosofia", "teologia"]),
    ("562", "Geografía, historia", "5", ["geografia", "historia"]),
    ("564", "Lenguas modernas, literatura, lingüística y afines", "5", ["lenguas modernas", "idiomas", "literatura", "linguistica", "traduccion", "filologia"]),
    ("566", "Psicología", "5", ["psicologia", "psicologo", "psicologa"]),
    ("569", "Sociología, trabajo social y afines", "5", ["sociologia", "sociologo", "trabajo social", "trabajador social", "desarrollo familiar"]),
    ("561", "Formación relacionada con el campo militar o policial", "5", ["ciencias militares", "militar", "policial", "administracion policial"]),

    ("69", "Administración", "6", [
        "administracion", "administrador", "administradora", "gestion empresarial", "negocios internacionales",
        "comercio exterior", "comercio internacional", "mercadeo", "marketing", "finanzas", "financiera",
        "logistica", "gestion logistica", "talento humano", "gestion humana", "recursos humanos",
        "administracion publica", "gestion publica", "gerencia", "gestion administrativa", "secretariado",
        "asistencia administrativa", "banca", "seguros", "turismo", "hoteleria", "gestion proyectos",
        "gestion transporte",
    ]),
    ("612", "Contaduría pública", "6", ["contaduria", "contador", "contadora", "contable", "contabilidad", "contabilidad finanzas", "revisoria fiscal", "costos auditoria"]),
    ("611", "Economía", "6", ["economia", "economista"]),

    ("818", "Arquitectura", "8", ["arquitectura", "arquitecto", "arquitecta", "urbanismo"]),
    ("821", "Ingeniería administrativa y afines", "8", ["ingenieria administrativa", "ingenieria financiera", "ingenieria comercial", "ingenieria mercados"]),
    ("822", "Ingeniería agrícola, forestal y afines", "8", ["ingenieria agricola", "ingenieria forestal", "forestal"]),
    ("823", "Ingeniería agroindustrial, alimentos y afines", "8", ["ingenieria agroindustrial", "ingenieria alimentos", "agroindustria", "agroindustrial", "procesamiento alimentos"]),
    ("824", "Ingeniería agronómica, pecuaria y afines", "8", ["ingenieria agronomica", "ingenieria pecuaria", "ingenieria agropecuaria", "agropecuaria"]),
    ("820", "Ingeniería ambiental, sanitaria y afines", "8", ["ingenieria ambiental", "ingenieria sanitaria", "ambiental", "sanitaria", "gestion ambiental", "saneamiento", "control ambiental"]),
    ("819", "Ingeniería biomédica y afines", "8", ["ingenieria biomedica", "bioingenieria", "biomedica"]),
    ("825", "Ingeniería civil y afines", "8", ["ingenieria civil", "obras civiles", "construcciones civiles", "construccion", "topografia", "vias"]),
    ("826", "Ingeniería de minas, metalurgia y afines", "8", ["ingenieria minas", "minas", "metalurgia", "ingenieria metalurgica", "ingenieria materiales"]),
    ("827", "Ingeniería de sistemas, telemática y afines", "8", [
        "ingenieria sistemas", "sistemas", "informatica", "software", "desarrollo software", "telematica",
        "programacion", "computacion", "ciencias computacion", "analisis desarrollo", "redes computadores",
        "ciberseguridad", "sistemas informacion",
    ]),
    ("828", "Ingeniería eléctrica y afines", "8", ["ingenieria electrica", "electrica", "electricidad", "electricista"]),
    ("829", "Ingeniería electrónica, telecomunicaciones y afines", "8", ["ingenieria electronica", "electronica", "telecomunicaciones", "mecatronica", "automatizacion", "instrumentacion industrial", "control"]),
    ("830", "Ingeniería industrial y afines", "8", ["ingenieria industrial", "ingenieria logistica", "produccion industrial", "procesos industriales", "gestion produccion", "seguridad industrial", "calidad"]),
    ("831", "Ingeniería mecánica y afines", "8", [
        "ingenieria mecanica", "mecanica", "mecanico", "mecanica automotriz", "mecanica industrial", "automotriz",
        "mantenimiento mecanico", "mantenimiento industrial", "electromecanica", "electromecanico", "soldadura",
        "diseño mecanico", "maquinas herramientas",
    ]),
    ("832", "Ingeniería química y afines", "8", ["ingenieria quimica", "procesos quimicos"]),
    ("833", "Otras ingenierías", "8", ["ingenieria petroleos", "petroleos", "ingenieria aeronautica", "aeronautica", "ingenieria naval", "transporte", "ingenieria transporte"]),

    ("934", "Biología, microbiología y afines", "9", ["biologia", "biologo", "microbiologia", "biotecnologia", "ecologia"]),
    ("935", "Física", "9", ["fisica", "fisico"]),
    ("936", "Geología, otros programas de ciencias naturales", "9", ["geologia", "geologo", "geociencias", "oceanografia"]),
    ("937", "Matemáticas, estadística y afines", "9", ["matematicas", "matematica", "estadistica", "actuaria", "ciencia datos"]),
    ("939", "Química y afines", "9", ["quimica", "quimico", "quimica farmaceutica", "quimica industrial"]),
]

NUCLEOS = {codigo: {"codigo": codigo, "nombre": nombre, "area_codigo": area, "area": AREAS[area]}
           for codigo, nombre, area, _ in _NUCLEOS}
_PALABRAS_CLAVE = {codigo: palabras for codigo, _, _, palabras in _NUCLEOS}


def listar_nucleos() -> list[dict]:
    """Todos los núcleos, en el orden del catálogo (agrupados por área)."""
    return list(NUCLEOS.values())


def nombre_nucleo(codigo: str) -> str:
    return NUCLEOS.get(str(codigo), {}).get("nombre", str(codigo))


def clasificar_titulo(titulo) -> list[str]:
    """
    Códigos NBC a los que pertenece `titulo` (p. ej. "Tecnología en mecánica
    automotriz" -> ["831"]). Lista vacía si no se reconoce. Gana la palabra
    clave más específica (con más palabras): "Medicina veterinaria" es
    Veterinaria, no Medicina; "Ingeniería financiera" es Ingeniería
    administrativa, no Administración.
    """
    if not _tokens(titulo):
        return []
    mejor_largo = 0
    encontrados: list[str] = []
    for codigo, palabras in _PALABRAS_CLAVE.items():
        largo = max((len(_tokens(p)) for p in palabras if _texto_incluye_keyword(titulo, p)), default=0)
        if largo == 0:
            continue
        if largo > mejor_largo:
            mejor_largo, encontrados = largo, [codigo]
        elif largo == mejor_largo:
            encontrados.append(codigo)
    return encontrados
