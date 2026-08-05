import { useEffect, useRef, useState } from "react";

/**
 * Botón "⋮" que despliega una lista de acciones. `acciones` es un arreglo de
 * { etiqueta, onClick, danger? }. Se cierra solo al hacer clic afuera o al
 * elegir una acción.
 */
export default function AccionesMenu({ acciones }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    function onClickAfuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickAfuera);
    return () => document.removeEventListener("mousedown", onClickAfuera);
  }, [abierto]);

  return (
    <div className="acciones-menu" ref={ref}>
      <button type="button" className="acciones-menu__boton" onClick={() => setAbierto((v) => !v)} aria-label="Más acciones">
        ⋮
      </button>
      {abierto && (
        <div className="acciones-menu__lista">
          {acciones.map((a, i) => (
            <button
              key={i}
              type="button"
              className={`acciones-menu__item ${a.danger ? "acciones-menu__item--danger" : ""}`}
              onClick={() => {
                setAbierto(false);
                a.onClick();
              }}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
