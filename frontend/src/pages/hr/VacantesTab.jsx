import { useEffect, useState } from "react";
import VacanteForm from "./VacanteForm";
import { useAuth } from "../../context/AuthContext";
import * as vacantesApi from "../../lib/api/vacantesApi";
import { vacanteVacia } from "../../lib/vacanteDefaults";

const ETIQUETA_ESTADO = {
  borrador: "Borrador",
  publicada: "Publicada",
  en_proceso: "En proceso",
  cerrada: "Cerrada",
  cancelada_desierta: "Cancelada/Desierta",
};
const CLASE_ESTADO = {
  borrador: "vac-status-pill--oculta",
  publicada: "vac-status-pill--activa",
  en_proceso: "vac-status-pill--oculta",
  cerrada: "vac-status-pill--cerrada",
  cancelada_desierta: "vac-status-pill--cerrada",
};

export default function VacantesTab() {
  const { token } = useAuth();
  const [vacantes, setVacantes] = useState([]);
  const [modo, setModo] = useState("lista"); // 'lista' | 'form'
  const [vacanteEnEdicion, setVacanteEnEdicion] = useState(null);
  const [enlaceCopiadoId, setEnlaceCopiadoId] = useState(null);
  const [error, setError] = useState("");

  async function recargar() {
    try {
      setVacantes(await vacantesApi.listarAdmin(token));
    } catch {
      setError("No se pudieron cargar las vacantes.");
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nuevaVacante() {
    setVacanteEnEdicion(vacanteVacia());
    setModo("form");
  }

  function editar(v) {
    setVacanteEnEdicion({ ...v, _editando: true });
    setModo("form");
  }

  async function guardar(v, pdfFile) {
    let guardada;
    if (v._editando) {
      guardada = await vacantesApi.actualizar(v.id, v, token);
    } else {
      guardada = await vacantesApi.crear(v, token);
    }
    if (pdfFile) {
      try {
        await vacantesApi.subirDocumentoPdf(guardada.id, pdfFile, token);
      } catch {
        alert("La vacante se guardó, pero el PDF no se pudo subir. Intenta subirlo de nuevo editando la vacante.");
      }
    }
    await recargar();
    setModo("lista");
  }

  async function cambiarEstado(v, nuevoEstado) {
    await vacantesApi.cambiarEstado(v.id, nuevoEstado, token);
    await recargar();
  }

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar esta vacante? Las postulaciones ya recibidas se conservan.")) return;
    await vacantesApi.eliminar(id, token);
    await recargar();
  }

  async function copiarEnlace(v) {
    const url = `${window.location.origin}/postularme/${v.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copia el enlace:", url);
    }
    setEnlaceCopiadoId(v.id);
    setTimeout(() => setEnlaceCopiadoId(null), 2000);
  }

  if (modo === "form") {
    return <VacanteForm vacanteInicial={vacanteEnEdicion} onGuardar={guardar} onCancelar={() => setModo("lista")} />;
  }

  return (
    <div className="card">
      {error && <div className="notice notice--danger">{error}</div>}
      <div className="hr-table-actions" style={{ marginBottom: 16 }}>
        <button type="button" className="btn btn-primary" onClick={nuevaVacante}>+ Nueva vacante</button>
      </div>

      {vacantes.length === 0 ? (
        <div className="empty-state">Aún no hay vacantes creadas.</div>
      ) : (
        <table className="plain-table">
          <thead>
            <tr><th>Cargo</th><th>Sede</th><th>Cierre</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {vacantes.map((v) => (
              <tr key={v.id}>
                <td>
                  <span className="mono" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{v.procesoNo}</span>
                  <br />{v.cargo}
                  {v.tieneDocumentoPdf && <span title="Tiene PDF adjunto" style={{ marginLeft: 6, fontSize: 12 }}>📄</span>}
                </td>
                <td>{v.sede || "—"}</td>
                <td>
                  {v.fechaCierre || "—"} {v.horaCierre || ""}
                  {v.estaCerrada && <span className="vac-status-pill vac-status-pill--cerrada" style={{ marginLeft: 6 }}>Cerrada por fecha</span>}
                </td>
                <td>
                  <select
                    value={v.estado}
                    onChange={(e) => cambiarEstado(v, e.target.value)}
                    className={`vac-status-pill ${CLASE_ESTADO[v.estado] || ""}`}
                    style={{ border: "none", fontSize: 12, padding: "4px 8px" }}
                  >
                    {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>{etiqueta}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="hr-table-actions">
                    <button className="hr-link-btn" onClick={() => editar(v)}>Editar</button>
                    <button className="hr-link-btn" onClick={() => copiarEnlace(v)}>
                      {enlaceCopiadoId === v.id ? "¡Copiado!" : "Copiar enlace"}
                    </button>
                    <button className="hr-link-btn hr-link-btn--danger" onClick={() => eliminar(v.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
