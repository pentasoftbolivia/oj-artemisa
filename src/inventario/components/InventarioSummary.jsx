import { Package, Users, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProgressFace from "./ProgressFace";

const InventarioSummary = ({
  totalStats,
  progressLevel,
  progressTextColors,
  inventariadorStats,
  getDisplayName,
  ubicacionLabel = "",
}) => {
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle
              className="text-lg font-bold flex items-center gap-2 tracking-wide"
              style={{ textShadow: "1px 1px 2px rgba(0, 0, 0, 0.35)" }}
            >
              <Package className="h-4 w-4" />
              RESUMEN DE TOTALES
            </CardTitle>

            <div className="flex items-center gap-3 text-right">
              <span
                className="text-base font-bold tracking-wide"
                style={{ color: progressTextColors[progressLevel] }}
              >
                PROGRESO
              </span>
              <span
                className="text-xl font-extrabold animate-flash"
                style={{ color: progressTextColors[progressLevel] }}
              >
                {totalStats.progreso.toFixed(2)}%
              </span>
              <ProgressFace level={progressLevel} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-blue-200 dark:border-blue-900 border-b-4 border-b-blue-400 dark:border-b-blue-700 p-4 bg-blue-50 dark:bg-blue-950/20 text-center shadow-lg shadow-blue-200/60 dark:shadow-blue-950/40">
              <div
                className="text-base font-bold text-blue-600 dark:text-blue-400 tracking-wide"
                style={{ textShadow: "1px 1px 2px rgba(37, 99, 235, 0.35)" }}
              >
                TOTAL ACTIVOS INVENTARIADOS
              </div>
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {totalStats.total}
              </div>
            </div>
            <div className="rounded-lg border border-red-200 dark:border-red-900 border-b-4 border-b-red-400 dark:border-b-red-700 p-4 bg-red-50 dark:bg-red-950/20 text-center shadow-lg shadow-red-200/60 dark:shadow-red-950/40">
              <div
                className="text-base font-bold text-red-600 dark:text-red-400 tracking-wide"
                style={{ textShadow: "1px 1px 2px rgba(220, 38, 38, 0.35)" }}
              >
                NO REVISADOS
              </div>
              <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                {totalStats.noRevisados}
              </div>
            </div>
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 border-b-4 border-b-yellow-400 dark:border-b-yellow-700 p-4 bg-yellow-50 dark:bg-yellow-950/20 text-center shadow-lg shadow-yellow-200/60 dark:shadow-yellow-950/40">
              <div
                className="text-base font-bold text-yellow-600 dark:text-yellow-400 tracking-wide"
                style={{ textShadow: "1px 1px 2px rgba(202, 138, 4, 0.35)" }}
              >
                REVISADOS
              </div>
              <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                {totalStats.revisados}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Resumen por Inventariador
          </CardTitle>
          {ubicacionLabel && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {ubicacionLabel}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {inventariadorStats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {inventariadorStats.map((stat) => (
                <div
                  key={stat.email}
                  className="rounded-lg border p-4 bg-muted/20 space-y-2"
                >
                  <div
                    className="text-xs font-semibold truncate text-muted-foreground"
                    title={stat.email}
                  >
                    {getDisplayName(stat.email)}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded p-2 text-center">
                      <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                        Pendientes
                      </div>
                      <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                        {stat.pendiente}
                      </div>
                    </div>
                    <div className="flex-1 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded p-2 text-center">
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Revisados
                      </div>
                      <div className="text-lg font-bold text-green-700 dark:text-green-300">
                        {stat.revisado}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default InventarioSummary;
