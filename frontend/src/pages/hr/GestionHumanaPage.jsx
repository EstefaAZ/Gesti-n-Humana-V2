import DocHeader from "../../components/DocHeader";
import VacantesTab from "./VacantesTab";

export default function GestionHumanaPage() {
  return (
    <>
      <DocHeader title="Procesos de Selección" showCode={false} />
      <main className="page">
        <VacantesTab />
      </main>
    </>
  );
}
