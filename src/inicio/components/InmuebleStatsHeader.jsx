import { Building2, Users, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export const BarraAvance = ({ inventariado, total }) => {
  const pct = total > 0 ? (inventariado / total) * 100 : 0;
  const color =
    pct <= 50 ? "#dc2626" : pct <= 80 ? "#eab308" : "#16a34a";

  return (
    <div className="col-span-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          Avance del total de activos en el inmueble
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          {pct.toFixed(2)}%
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden border border-border">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
          title={`${inventariado} de ${total} activos`}
        />
      </div>
    </div>
  );
};

const InmuebleStatsHeader = ({
  totalInmueble,
  totalInventariado,
  totalEnProceso,
  onShowInventariados,
  onShowEnProceso,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
      <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
        <span className="text-xs font-medium text-muted-foreground">Total Activos</span>
        <div className="flex items-center gap-2 mt-1">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xl font-bold">{totalInmueble}</span>
        </div>
      </div>

      <div className="rounded-lg border bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800 p-3 text-card-foreground shadow-sm flex flex-col justify-between">
        <div>
          <span className="text-xs font-medium text-green-700 dark:text-green-400">
            Inventariados
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-xl font-bold text-green-700 dark:text-green-400">
              {totalInventariado}
            </span>
          </div>
        </div>
        {totalInventariado > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShowInventariados()}
            className="mt-2 h-7 text-xs text-green-700 hover:text-green-800 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/50 justify-start px-2"
          >
            Ver todos los inventariados →
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-card-foreground shadow-sm flex flex-col justify-between">
        <div>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            En Proceso
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xl font-bold text-amber-700 dark:text-amber-400">
              {totalEnProceso}
            </span>
          </div>
        </div>
        {totalEnProceso > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShowEnProceso()}
            className="mt-2 h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50 justify-start px-2"
          >
            Ver todos en proceso →
          </Button>
        )}
      </div>

      <BarraAvance inventariado={totalInventariado} total={totalInmueble} />
    </div>
  );
};

export default InmuebleStatsHeader;
