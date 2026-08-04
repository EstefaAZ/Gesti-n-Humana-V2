import { useState } from "react";

/**
 * Un <select> con las opciones dadas + "Otro" al final. Si el usuario elige
 * "Otro", cambia a un campo de texto libre (con un enlace para volver a la
 * lista). Si `opciones` viene vacío (por ejemplo, ciudad sin departamento
 * elegido todavía), se muestra directamente como texto libre.
 */
export default function SelectConOtro({ value, onChange, opciones, placeholder = "Seleccione…", disabled = false }) {
  const [modoTexto, setModoTexto] = useState(() => value !== "" && !opciones.includes(value));

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
      value={value}
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
