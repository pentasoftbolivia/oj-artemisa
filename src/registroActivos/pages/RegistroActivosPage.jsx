import RegistroActivos from "@/configTransferencias/components/RegistroActivos";

const RegistroActivosPage = () => {
  return (
    <div className="container mt-2 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registro Activos</h1>
        <p className="text-muted-foreground">
          Registro de nuevos activos fijos
        </p>
      </div>
      <RegistroActivos />
    </div>
  );
};

export default RegistroActivosPage;
