import { Link } from "react-router-dom";
import DocHeader from "../components/DocHeader";

export default function PoliticaDatosPage() {
  return (
    <>
      <DocHeader title="Política de Tratamiento de Datos Personales" showCode={false} />
      <main className="page">
        <div className="card">
          <div className="notice notice--warning">
            Este documento está pendiente de publicación por parte del equipo Legal de Aguas Nacionales EPM.
            Cuando esté listo, este espacio mostrará el texto oficial completo (Ley 1581 de 2012).
          </div>
          <p className="text-center mt-24"><Link to="/registro" className="text-muted">← Volver al registro</Link></p>
        </div>
      </main>
    </>
  );
}
