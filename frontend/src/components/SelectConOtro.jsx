import { useState } from "react";

/** minúsculas y sin tildes — para comparar valores guardados antes de que existiera el catálogo. */
function _normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Un <select> con las opciones dadas + "Otro" al final. Si el usuario elige
 * "Otro", cambia a un campo de texto libre (con un enlace para volver a la
 * lista). Si `opciones` viene vacío (por ejemplo, ciudad sin departamento
 * elegido todavía), se muestra directamente como texto libre.
 *
 * El match contra `opciones` es tolerante a tildes/mayúsculas: un valor
 * guardado como "Ingles" preselecciona "Inglés" del catálogo en vez de caer
 * a modo texto libre solo por la tilde.
 */
export default function SelectConOtro({ value, onChange, opciones, placeholder = "Seleccione…", disabled = false }) {
  const opcionCoincidente = opciones.find((o) => _normalizar(o) === _normalizar(value));
  const [modoTexto, setModoTexto] = useState(() => value !== "" && !opcionCoincidente);

  const sinOpciones = opciones.length === 0;

  if (sinOpciones || modoTexto) {
    return (
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={sinOpciones ? placeholder : "Escribe el nombre"}
        />
        {!sinOpciones && (
          <button
            type="button"
            className="btn-link"
            style={{ fontSize: 11.5, marginTop: 4, padding: 0 }}
            onClick={() => {
              setModoTexto(false);
              onChange("");
            }}
          >
            ‹ Elegir de la lista
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={opcionCoincidente || value}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value === "__OTRO__") {
          setModoTexto(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
    >
      <option value="">{placeholder}</option>
      {opciones.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
      <option value="__OTRO__">Otro</option>
    </select>
  );
}
