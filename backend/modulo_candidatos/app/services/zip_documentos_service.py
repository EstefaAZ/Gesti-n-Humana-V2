# ==============================================================
# modulo_candidatos / app/services/zip_documentos_service.py
# Empaqueta en un .zip todos los documentos adjuntos (de un perfil o de
# una postulación) para descargarlos de una sola vez, en vez de uno por uno.
# ==============================================================

import base64
import io
import re
import unicodedata
import zipfile

# Una carpeta por tipo de documento, numeradas para que salgan en el mismo
# orden que en el formulario.
CARPETAS = {
    "cedula": "1. Cedula de ciudadania",
    "certificados_laborales": "2. Certificados laborales",
    "certificados_estudio": "3. Certificados de estudio y cursos",
    "tarjeta_profesional": "4. Tarjeta profesional",
}


class SinDocumentosError(Exception):
    """No hay ningún documento que se pueda empaquetar."""
    pass


def nombre_seguro(texto: str, por_defecto: str = "documento") -> str:
    """Nombre apto para un archivo: sin rutas, sin caracteres reservados y sin
    tildes (algunos descompresores de Windows las muestran mal)."""
    texto = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode("ascii")
    texto = texto.replace("\\", "/").split("/")[-1]
    texto = re.sub(r'[<>:"|?*\x00-\x1f]', "", texto).strip(" .")
    return texto or por_defecto


def armar_zip(documentos: dict) -> bytes:
    """documentos: {categoria: [{"nombre", "contenido_base64"}, ...]} → bytes del .zip.
    Los documentos dañados se omiten. Lanza SinDocumentosError si no queda ninguno."""
    buffer = io.BytesIO()
    agregados = 0
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for categoria, carpeta in CARPETAS.items():
            usados: set[str] = set()
            for i, doc in enumerate((documentos or {}).get(categoria) or []):
                try:
                    contenido = base64.b64decode(doc["contenido_base64"])
                except Exception:
                    continue
                nombre = nombre_seguro(doc.get("nombre"), f"{categoria}-{i + 1}.pdf")
                # Dos archivos con el mismo nombre en la misma carpeta: se numeran.
                base, punto, ext = nombre.rpartition(".")
                if not punto:
                    base, ext = nombre, ""
                candidato, n = nombre, 2
                while candidato.lower() in usados:
                    candidato = f"{base} ({n}).{ext}" if ext else f"{base} ({n})"
                    n += 1
                usados.add(candidato.lower())
                zf.writestr(f"{carpeta}/{candidato}", contenido)
                agregados += 1
    if agregados == 0:
        raise SinDocumentosError("No hay documentos adjuntos para descargar.")
    return buffer.getvalue()


def content_disposition(nombre_archivo: str, por_defecto: str = "documento") -> str:
    """Cabecera de descarga con el nombre real (con tildes) para los navegadores que
    lo soportan (filename*, RFC 5987) y una versión sin tildes de respaldo."""
    from urllib.parse import quote

    # Una "/" en el ID del proceso no es una ruta: se cambia por "-" antes de limpiar.
    nombre_archivo = str(nombre_archivo or "").replace("/", "-").replace("\\", "-")
    respaldo = nombre_seguro(nombre_archivo, por_defecto)
    real = re.sub(r'[\/:*?"<>|\x00-\x1f]', "", str(nombre_archivo or "")).strip(" .") or respaldo
    return f"attachment; filename=\"{respaldo}\"; filename*=UTF-8''{quote(real)}"


def respuesta_zip_headers(nombre_archivo: str) -> dict:
    return {"Content-Disposition": f'attachment; filename="{nombre_seguro(nombre_archivo, "documentos.zip")}"'}
