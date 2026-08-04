import { useEffect, useState } from "react";
import DocHeader from "../../components/DocHeader";
import { useAuth } from "../../context/AuthContext";
import * as authApi from "../../lib/api/authApi";
import { ApiError } from "../../lib/api/httpClient";

const ETIQUETA_ROL = { candidato: "Candidato", gestor_humano: "Gestión Humana", admin: "Administrador" };
const ROLES_ASIGNABLES = ["candidato", "gestor_humano", "admin"];

export default function UsuariosPage() {
  const { token, usuario: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState("");

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombreCompleto: "", email: "", password: "", rol: "gestor_humano" });
  const [errorForm, setErrorForm] = useState("");
  const [creando, setCreando] = useState(false);

  const [cambiandoRolId, setCambiandoRolId] = useState(null);

  async function cargar() {
    try {
      setUsuarios(await authApi.listarUsuarios(token));
    } catch {
      setError("No se pudo cargar la lista de usuarios.");
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCrear() {
    setErrorForm("");
    setCreando(true);
    try {
      await authApi.crearUsuarioInterno(form, token);
      setForm({ nombreCompleto: "", email: "", password: "", rol: "gestor_humano" });
      setMostrarForm(false);
      await cargar();
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.detail : "No se pudo crear la cuenta.");
    } finally {
      setCreando(false);
    }
  }

  async function handleCambiarRol(usuarioId, nuevoRol) {
    setCambiandoRolId(usuarioId);
    try {
      await authApi.cambiarRol(usuarioId, nuevoRol, token);
      await cargar();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "No se pudo cambiar el rol.");
    } finally {
      setCambiandoRolId(null);
    }
  }

  return (
    <>
      <DocHeader title="Usuarios" showCode={false} />
      <main className="page" style={{ maxWidth: 900 }}>
        {error && <div className="notice notice--danger">{error}</div>}

        <div className="card">
          <div className="hr-table-actions" style={{ justifyContent: "space-between", marginBottom: mostrarForm ? 20 : 0 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Usuarios registrados</h2>
            <button type="button" className="btn btn-primary" onClick={() => setMostrarForm((v) => !v)}>
              {mostrarForm ? "Cancelar" : "+ Crear cuenta interna"}
            </button>
          </div>

          {mostrarForm && (
            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 20 }}>
              <p className="text-muted" style={{ fontSize: 12.5, marginTop: -4 }}>
                Esto es solo para cuentas de <strong>gestor_humano</strong> o <strong>admin</strong>. Los candidatos se
                registran ellos mismos desde "Crear cuenta" en el login.
              </p>
              {errorForm && <div className="notice notice--danger">{errorForm}</div>}
              <div className="field-grid">
                <div className="field">
                  <label>Nombre completo</label>
                  <input type="text" value={form.nombreCompleto} onChange={(e) => setForm((f) => ({ ...f, nombreCompleto: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Correo electrónico</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Contraseña provisional</label>
                  <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                  <span className="hint">Mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial.</span>
                </div>
                <div className="field">
                  <label>Rol</label>
                  <select value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}>
                    <option value="gestor_humano">Gestión Humana</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <button type="button" className="btn btn-primary mt-24" onClick={handleCrear} disabled={creando}>
                {creando ? "Creando…" : "Crear cuenta"}
              </button>
            </div>
          )}

          {usuarios === null ? (
            <p className="text-muted">Cargando…</p>
          ) : (
            <table className="plain-table">
              <thead>
                <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th></th></tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nombreCompleto}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.rol}
                        disabled={cambiandoRolId === u.id || u.id === usuarioActual?.id}
                        onChange={(e) => handleCambiarRol(u.id, e.target.value)}
                        style={{ fontSize: 12.5, padding: "4px 8px", width: "auto" }}
                      >
                        {ROLES_ASIGNABLES.map((r) => (
                          <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td>{u.id === usuarioActual?.id && <span className="text-muted" style={{ fontSize: 11.5 }}>(tú)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
