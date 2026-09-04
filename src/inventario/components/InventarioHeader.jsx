import { memo } from "react";

/**
 * Header responsivo del módulo Inventario.
 */
const InventarioHeader = memo(() => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          INVENTARIO DE ACTIVOS FIJOS
        </h1>
        <p className="text-sm text-muted-foreground">
          Revisión e Impresión de Actas de Asignación y Etiquetas
        </p>
      </div>
    </div>
  );
});

InventarioHeader.displayName = "InventarioHeader";
export default InventarioHeader;

