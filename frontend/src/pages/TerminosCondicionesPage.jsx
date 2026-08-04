import { Link } from "react-router-dom";
import DocHeader from "../components/DocHeader";

export default function TerminosCondicionesPage() {
  return (
    <>
      <DocHeader title="Términos y Condiciones" showCode={false} />
      <main className="page">
        <div className="card">
          <div className="notice notice--warning">
            Este documento está pendiente de publicación por parte del equipo Legal de Aguas Nacionales EPM.
            Cuando esté listo, este espacio mostrará el texto oficial completo.
          </div>
          <p className="text-center mt-24"><Link to="/registro" className="text-muted">← Volver al registro</Link></p>
        </div>
      </main>
    </>
  );
}
