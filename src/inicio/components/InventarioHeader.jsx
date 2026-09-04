import { memo } from "react";
import { Building2, CalendarDays, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Header responsivo del módulo Inventario.
 * KISS: mobile-first.
 * - Web (≥640px): los 3 botones en una sola fila horizontal a la derecha del título.
 * - Móvil (<640px): columna Reporte de Paneles → POR INMUEBLE → POR FECHA.
 */
const InventarioHeader = memo(
  ({ onOpenInmueble, onOpenFecha, onExportPaneles, isGeneratingExcel }) => {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            DASHBOARD PRINCIPAL
          </h1>
          <p className="text-sm text-muted-foreground">
            Panel de Control de Inventario
          </p>
        </div>

        {/* Botonera: móvil columna en orden pedido, web fila única */}
        <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0 sm:flex-row sm:items-center sm:flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center bg-sky-300 hover:bg-sky-400 text-sky-950 border-sky-400 sm:w-auto min-h-11 sm:min-h-0 order-1"
            onClick={onExportPaneles}
            disabled={isGeneratingExcel}
            aria-label="Ver Reporte de Paneles"
          >
            {isGeneratingExcel ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            REPORTE DE PANELES
          </Button>
          <Button
            onClick={onOpenInmueble}
            className="w-full sm:w-auto justify-center min-h-11 sm:min-h-0 order-2"
            aria-label="Ver por inmueble"
          >
            <Building2 className="mr-2 h-4 w-4" />
            POR INMUEBLE
          </Button>
          <Button
            variant="outline"
            onClick={onOpenFecha}
            className="w-full sm:w-auto justify-center min-h-11 sm:min-h-0 order-3"
            aria-label="Ver por fecha"
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            POR FECHA
          </Button>
        </div>
      </div>
    );
  },
);

InventarioHeader.displayName = "InventarioHeader";
export default InventarioHeader;
