# ==============================================================
# modulo_candidatos / app/services/perfil_candidato_service.py
# ==============================================================

from typing import Optional

from sqlalchemy.orm import Session

from app.models.perfil_candidato import PerfilCandidato
from app.schemas.perfil_candidato import (
    PerfilCandidatoGuardar,
    PerfilCandidatoBorrador,
    DocumentosAdjuntosPerfil,
)


class NombreNoCoincideError(Exception):
    """La autorización debe firmarse con el mismo nombre con el que el candidato se registró."""
    pass


class DocumentoFaltanteError(Exception):
    """El documento no trae contenido y tampoco existe ya guardado con ese nombre."""
    pass


def _normalizar_nombre(nombre: str) -> str:
    # Flexible: ignora mayúsculas/minúsculas y espacios de más (al inicio, al
    # final, y dobles espacios entre palabras) — pero el texto debe ser el mismo.
    return " ".join(nombre.strip().split()).lower()


def obtener_perfil(db: Session, usuario_id: str) -> Optional[PerfilCandidato]:
    return db.query(PerfilCandidato).filter(PerfilCandidato.usuario_id == usuario_id).first()


def listar_todos(db: Session) -> list[PerfilCandidato]:
    """Para la página "Candidatos" de Gestión Humana — todos los perfiles guardados."""
    return db.query(PerfilCandidato).order_by(PerfilCandidato.fecha_creacion.desc()).all()


class DocumentoNoEncontradoError(Exception):
    pass


CATEGORIAS_DOCUMENTOS = ("cedula", "certificados_laborales", "certificados_estudio", "tarjeta_profesional")


def obtener_documento(db: Session, usuario_id: str, categoria: str, indice: int) -> tuple[bytes, str]:
    import base64

    perfil = obtener_perfil(db, usuario_id)
    if not perfil:
        raise DocumentoNoEncontradoError("Este candidato no tiene un perfil guardado.")
    if categoria not in CATEGORIAS_DOCUMENTOS:
        raise DocumentoNoEncontradoError(f"Categoría de documento inválida: {categoria}.")

    lista = (perfil.documentos_adjuntos or {}).get(categoria, [])
    if indice < 0 or indice >= len(lista):
        raise DocumentoNoEncontradoError("No existe un documento con ese índice en esa categoría.")

    doc = lista[indice]
    try:
        contenido = base64.b64decode(doc["contenido_base64"])
    except Exception:
        raise DocumentoNoEncontradoError("El documento está corrupto y no se pudo leer.")
    return contenido, doc.get("nombre", f"{categoria}-{indice}.pdf")


def obtener_estado_perfil(db: Session, usuario_id: str) -> dict:
    perfil = obtener_perfil(db, usuario_id)
    return {"existe": perfil is not None, "completado": bool(perfil and perfil.completado)}


def _resolver_documentos(
    documentos_nuevos: DocumentosAdjuntosPerfil, documentos_existentes: Optional[dict]
) -> dict:
    """
    Si el candidato reutiliza un documento ya subido antes (viene solo con
    'nombre', sin contenido_base64 — porque el backend nunca lo reenvía en
    /me ni en /me/borrador), lo completamos con el archivo que ya está
    guardado en la base de datos, buscando por nombre dentro de la misma
    categoría. Si no hay match, es un error real: el frontend perdió el
    rastro de un archivo que nunca se llegó a guardar.
    """
    documentos_existentes = documentos_existentes or {}
    resultado = {}
    for categoria in CATEGORIAS_DOCUMENTOS:
        existentes_por_nombre = {
            doc["nombre"]: doc for doc in documentos_existentes.get(categoria, [])
        }
        lista_resuelta = []
        for doc in getattr(documentos_nuevos, categoria):
            if doc.contenido_base64:
                lista_resuelta.append({"nombre": doc.nombre, "contenido_base64": doc.contenido_base64})
            else:
                previo = existentes_por_nombre.get(doc.nombre)
                if not previo:
                    raise DocumentoFaltanteError(
                        f'El documento "{doc.nombre}" no tiene contenido y no hay ningún archivo '
                        f"guardado con ese nombre. Vuelve a subirlo."
                    )
                lista_resuelta.append(previo)
        resultado[categoria] = lista_resuelta
    return resultado


def guardar_perfil(
    db: Session, usuario_id: str, datos: PerfilCandidatoGuardar, nombre_cuenta: str
) -> PerfilCandidato:
    """
    Crea o reemplaza el perfil del candidato. SIEMPRE valida que el nombre en
    autorizacion coincida (de forma flexible) con el nombre de la cuenta —
    nunca se puede completar el perfil ni guardar cambios con un nombre
    distinto al de la cuenta.
    """
    if _normalizar_nombre(datos.autorizacion.nombre_completo) != _normalizar_nombre(nombre_cuenta):
        raise NombreNoCoincideError(
            f'El nombre en Autorización debe ser el mismo con el que te registraste ("{nombre_cuenta}").'
        )

    perfil = obtener_perfil(db, usuario_id)
    if not perfil:
        perfil = PerfilCandidato(usuario_id=usuario_id)
        db.add(perfil)

    documentos_resueltos = _resolver_documentos(datos.documentos_adjuntos, perfil.documentos_adjuntos)

    perfil.datos_personales = datos.datos_personales
    perfil.registros_ii = datos.registros_ii
    perfil.experiencia = datos.experiencia
    perfil.conflicto = datos.conflicto
    perfil.documentos_adjuntos = documentos_resueltos
    perfil.autorizacion = datos.autorizacion.model_dump()
    perfil.completado = True

    db.commit()
    db.refresh(perfil)
    return perfil


def guardar_borrador(db: Session, usuario_id: str, datos: PerfilCandidatoBorrador) -> PerfilCandidato:
    """
    Guardado automático mientras el candidato avanza por el wizard — sin
    ninguna validación (puede venir a medias). Nunca marca el perfil como
    completado, y si YA estaba completado (el candidato volvió a editarlo),
    nunca lo desmarca — eso evita que un guardado de fondo, a mitad de una
    edición, lo saque del sitio sin querer.
    """
    perfil = obtener_perfil(db, usuario_id)
    if not perfil:
        perfil = PerfilCandidato(usuario_id=usuario_id, completado=False)
        db.add(perfil)

    perfil.datos_personales = datos.datos_personales
    perfil.registros_ii = datos.registros_ii
    perfil.experiencia = datos.experiencia
    perfil.conflicto = datos.conflicto
    perfil.documentos_adjuntos = datos.documentos_adjuntos
    perfil.autorizacion = datos.autorizacion
    # completado se deja tal cual estaba — este guardado nunca lo cambia.

    db.commit()
    db.refresh(perfil)
    return perfil