import { useEffect, useState } from "react";
import VacanteForm from "./VacanteForm";
import AccionesMenu from "../../components/AccionesMenu";
import { useAuth } from "../../context/AuthContext";
import * as vacantesApi from "../../lib/api/vacantesApi";
import * as solicitudesApi from "../../lib/api/solicitudesApi";
import { vacanteVacia } from "../../lib/vacanteDefaults";

const ESTADOS = ["publicada", "en_proceso", "cerrada", "borrador", "cancelada_desierta"];

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
  en_proceso: "vac-status-pill--en-proceso",
  cerrada: "vac-status-pill--cerrada",
  cancelada_desierta: "vac-status-pill--cancelada",
};

export default function VacantesTab() {
  const { token } = useAuth();
  const [vacantes, setVacantes] = useState([]);
  const [conteo, setConteo] = useState({});
  const [modo, setModo] = useState("lista"); // 'lista' | 'form'
  const [vacanteEnEdicion, setVacanteEnEdicion] = useState(null);
  const [enlaceCopiadoId, setEnlaceCopiadoId] = useState(null);
  const [editandoEstadoId, setEditandoEstadoId] = useState(null);
  const [error, setError] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  async function recargar() {
    try {
      const [listaVacantes, conteoPost] = await Promise.all([
        vacantesApi.listarAdmin(token),
        solicitudesApi.conteoPorVacante(token),
      ]);
      setVacantes(listaVacantes);
      setConteo(conteoPost);
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
    setEditandoEstadoId(null);
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

  const conteosPorEstado = ESTADOS.reduce((acc, e) => {
    acc[e] = vacantes.filter((v) => v.estado === e).length;
    return acc;
  }, {});

  const filtradas = vacantes
    .filter((v) => filtroEstado === "todas" || v.estado === filtroEstado)
    .filter((v) => !busqueda.trim() || `${v.cargo} ${v.procesoNo}`.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div>
      {error && <div className="notice notice--danger">{error}</div>}

      <div className="hr-table-actions" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
        <button type="button" className="btn btn-primary" onClick={nuevaVacante}>+ Nueva vacante</button>
      </div>

      <div className="stat-cards-grid stat-cards-grid--compact" style={{ marginBottom: 20 }}>
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            className="stat-card"
            style={{ textAlign: "left", cursor: "pointer", border: filtroEstado === e ? "2px solid var(--color-primary)" : undefined }}
            onClick={() => setFiltroEstado(filtroEstado === e ? "todas" : e)}
          >
            <div className="stat-card__value">{conteosPorEstado[e]}</div>
            <div className="stat-card__label">{ETIQUETA_ESTADO[e]}</div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="hr-table-actions" style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Buscar vacante…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          {filtroEstado !== "todas" && (
            <button type="button" className="hr-link-btn" onClick={() => setFiltroEstado("todas")}>
              Quitar filtro ({ETIQUETA_ESTADO[filtroEstado]}) ✕
            </button>
          )}
        </div>

        {filtradas.length === 0 ? (
          <div className="empty-state">
            {vacantes.length === 0 ? "Aún no hay vacantes creadas." : "Ninguna vacante coincide con el filtro."}
          </div>
        ) : (
          <table className="plain-table">
            <thead>
              <tr><th>Vacante</th><th>Fecha cierre</th><th>Postulaciones</th><th>Fecha publicación</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {filtradas.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>{v.procesoNo}</span>
                    <br />{v.cargo}
                    {v.tieneDocumentoPdf && <span title="Tiene PDF adjunto" style={{ marginLeft: 6, fontSize: 12 }}>📄</span>}
                  </td>
                  <td>{v.fechaCierre || "—"} {v.horaCierre || ""}</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{conteo[v.id] || 0}</td>
                  <td>{v.fechaCreacion ? new Date(v.fechaCreacion).toLocaleDateString("es-CO") : "—"}</td>
                  <td>
                    {editandoEstadoId === v.id ? (
                      <select
                        autoFocus
                        value={v.estado}
                        onChange={(e) => cambiarEstado(v, e.target.value)}
                        onBlur={() => setEditandoEstadoId(null)}
                        className="vac-status-select"
                      >
                        {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
                          <option key={valor} value={valor}>{etiqueta}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`vac-status-pill ${CLASE_ESTADO[v.estado] || ""}`}>{ETIQUETA_ESTADO[v.estado]}</span>
                    )}
                  </td>
                  <td>
                    <AccionesMenu
                      acciones={[
                        { etiqueta: "Cambiar estado", onClick: () => setEditandoEstadoId(v.id) },
                        { etiqueta: "Editar", onClick: () => editar(v) },
                        { etiqueta: enlaceCopiadoId === v.id ? "¡Copiado!" : "Copiar enlace", onClick: () => copiarEnlace(v) },
                        { etiqueta: "Eliminar", onClick: () => eliminar(v.id), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
          Mostrando {filtradas.length} de {vacantes.length} vacantes
        </p>
      </div>
    </div>
  );
}
