import { useState } from "react";
import { Link } from "react-router-dom";
import DocHeader from "../../components/DocHeader";
import VacantesTab from "./VacantesTab";
import PostulacionesTab from "./PostulacionesTab";

export default function GestionHumanaPage() {
  const [tab, setTab] = useState("vacantes");

  return (
    <>
      <DocHeader title="Gestión Humana" showCode={false} />
      <main className="page">
        <div className="hr-tabs">
          <button className={`hr-tab-btn ${tab === "vacantes" ? "is-active" : ""}`} onClick={() => setTab("vacantes")}>Vacantes</button>
          <button className={`hr-tab-btn ${tab === "postulaciones" ? "is-active" : ""}`} onClick={() => setTab("postulaciones")}>Postulaciones</button>
        </div>

        {tab === "vacantes" ? <VacantesTab /> : <PostulacionesTab />}

        <p className="text-center mt-24">
          <Link to="/" className="text-muted">← Ver vista del candidato</Link>
        </p>
      </main>
    </>
  );
}
