# ==============================================================
# modulo_candidatos / app/services/coincidencia_texto.py
#
# Comparación de textos escritos por personas (títulos, cursos, idiomas):
# sin tildes ni mayúsculas, por palabras completas y tolerando la terminación
# de género/número. La usan la evaluación automática y el catálogo NBC.
# ==============================================================

import re
import unicodedata


def _clave(texto) -> str:
    """minúsculas y sin tildes — para que "Tecnico", "Técnico" y "TÉCNICO" sean lo mismo."""
    sin_tildes = unicodedata.normalize("NFD", (texto or "").strip())
    return "".join(c for c in sin_tildes if unicodedata.category(c) != "Mn").lower()


# Terminaciones de género/número más comunes en español. Se prueban de la más
# larga a la más corta para no cortar de más (p. ej. "ia" antes que "a").
_SUFIJOS_VARIABLES = ("es", "as", "os", "ia", "a", "o", "e", "s")


def _raiz(palabra) -> str:
    """
    Raíz aproximada de una palabra: quita la terminación de género/número más
    común para que "ingeniero", "ingeniera" e "ingenieria" compartan la misma
    raíz ("ingenier"). No es un stemmer completo — alcanza para keywords
    cortos de profesión/título, que es todo lo que necesita este matching.
    """
    clave = _clave(palabra)
    for sufijo in _SUFIJOS_VARIABLES:
        if clave.endswith(sufijo) and len(clave) - len(sufijo) >= 4:
            return clave[: -len(sufijo)]
    return clave


# Palabras de enlace que no cambian el sentido de un título o curso: así
# "Ingeniería de Sistemas" y "Ingeniero en Sistemas" se comparan igual.
_PALABRAS_VACIAS = {"de", "del", "la", "las", "el", "los", "en", "y", "e", "para", "con", "a", "al"}


def _tokens(texto) -> list[str]:
    """Palabras de `texto` sin tildes ni mayúsculas, separando por cualquier signo
    (espacio, guion, coma, paréntesis…) y sin palabras de enlace. "Power-BI" y
    "Power BI" dan los mismos tokens."""
    return [t for t in re.split(r"[^a-z0-9]+", _clave(texto)) if t and t not in _PALABRAS_VACIAS]


def _misma_palabra(a: str, b: str) -> bool:
    """Igual, o igual salvo la terminación de género/número (ingeniero / ingeniería)."""
    return a == b or _raiz(a) == _raiz(b)


def _coincide_por_ventaneo(texto_tokens, kw_tokens) -> bool:
    """
    True si alguna secuencia de tokens consecutivos de `texto_tokens`, unida
    sin separador, es EXACTAMENTE igual al keyword unido sin separador. Así
    "Power BI" (keyword) reconoce "PowerBI" (texto) y al revés. Es igualdad
    exacta de la ventana completa: "ISO 9001" nunca confunde con "ISO 14001".
    """
    kw_compacto = "".join(kw_tokens)
    if not kw_compacto:
        return False
    for i in range(len(texto_tokens)):
        acumulado = ""
        for j in range(i, len(texto_tokens)):
            acumulado += texto_tokens[j]
            if acumulado == kw_compacto:
                return True
            if len(acumulado) > len(kw_compacto):
                break
    return False


def _texto_incluye_keyword(texto, keyword) -> bool:
    """
    True si las palabras de `keyword` aparecen seguidas, como palabras completas,
    en `texto`. Tolera tildes, mayúsculas, palabras de enlace y la terminación de
    género/número de CADA palabra ("Ingeniero Civil" cumple "Ingeniería Civil").
    No acepta pedazos de palabra: "Excel" no coincide con "Excelencia", ni
    "Java" con "JavaScript". Como último recurso compara sin espacios
    ("PowerBI" cumple "Power BI").
    """
    kw = _tokens(keyword)
    if not kw:
        return False
    palabras = _tokens(texto)
    n = len(kw)
    for i in range(len(palabras) - n + 1):
        if all(_misma_palabra(palabras[i + k], kw[k]) for k in range(n)):
            return True
    return _coincide_por_ventaneo(palabras, kw)
