import RegistroActivos from "@/configTransferencias/components/RegistroActivos";

const RegistroActivosPage = () => {
  return (
    <div className="container mt-2 space-y-4 sm:space-y-6 px-3 sm:px-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">Registro Activos</h1>
        <p className="text-sm text-muted-foreground leading-tight">Registro de nuevos activos fijos</p>
      </div>
      <RegistroActivos />
    </div>
  );
};

export default RegistroActivosPage;
