import { useState, useMemo } from "react";
import { Package, Users, MapPin, Search, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ComboboxField from "@/components/ui/combobox-field";
import ProgressFace from "./ProgressFace";

const InventarioSummary = ({
  totalStats,
  inmuebleCount = 0,
  summaryInmuebleCount = 0,
  progressLevel,
  progressTextColors,
  inventariadorStats,
  summaryStats = null,
  getDisplayName,
  ubicacionLabel = "",
  onBuscar,
  onLimpiar,
  isLoadingSummary = false,
  ciudadOptions = [],
  inmuebleOptions = [],
  inmuebleCiudadMap = {},
}) => {
  const [ciudad, setCiudad] = useState("");
  const [inmueble, setInmueble] = useState("");

  const hasSummaryFilter = summaryStats !== null;
  const isFilterActive = !!ciudad || !!inmueble;

  const filteredInmuebleOptions = useMemo(() => {
    if (!ciudad) return inmuebleOptions;
    return inmuebleOptions.filter(
      (o) => inmuebleCiudadMap[String(o.value).trim()] === String(ciudad).trim(),
    );
  }, [inmuebleOptions, inmuebleCiudadMap, ciudad]);

  const displayStats = hasSummaryFilter ? summaryStats : inventariadorStats;
  const displayInmuebleCount = hasSummaryFilter ? summaryInmuebleCount : inmuebleCount;

  const selectedCiudadLabel = useMemo(
    () => ciudadOptions.find((o) => String(o.value).trim() === String(ciudad).trim())?.label ?? "",
    [ciudadOptions, ciudad],
  );
  const selectedInmuebleLabel = useMemo(
    () => inmuebleOptions.find((o) => String(o.value).trim() === String(inmueble).trim())?.label ?? "",
    [inmuebleOptions, inmueble],
  );
  const summaryLabel = [selectedCiudadLabel, selectedInmuebleLabel].filter(Boolean).join(" / ");

  const handleBuscar = () => {
    onBuscar?.({ ciudad, inmueble });
  };

  const handleLimpiar = () => {
    setCiudad("");
    setInmueble("");
    onLimpiar?.();
  };

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
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Resumen por Inventariador
            </CardTitle>
            <div className="flex items-center gap-2 text-right whitespace-nowrap">
              <span
                className="text-sm font-bold tracking-wide text-muted-foreground"
                style={{ textShadow: "1px 1px 2px rgba(0, 0, 0, 0.25)" }}
              >
                ACTIVOS POR INMUEBLE
              </span>
              <span
                className="text-2xl font-extrabold leading-none"
                style={{ textShadow: "1px 1px 2px rgba(0, 0, 0, 0.35)" }}
              >
                {displayInmuebleCount}
              </span>
            </div>
          </div>
          {(ubicacionLabel || summaryLabel) && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {hasSummaryFilter ? summaryLabel : ubicacionLabel}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComboboxField
              label="Ciudad"
              value={ciudad}
              onValueChange={(val) => {
                setCiudad(val);
                setInmueble("");
              }}
              options={ciudadOptions}
              placeholder="Seleccionar ciudad..."
              searchPlaceholder="Buscar ciudad..."
              emptyMessage="Sin resultados"
            />
            <ComboboxField
              label="Inmueble"
              value={inmueble}
              onValueChange={setInmueble}
              options={filteredInmuebleOptions}
              placeholder="Seleccionar inmueble..."
              searchPlaceholder="Buscar inmueble..."
              emptyMessage="Sin resultados"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleBuscar} disabled={isLoadingSummary}>
              {isLoadingSummary ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
            {isFilterActive && (
              <Button
                variant="outline"
                onClick={handleLimpiar}
                disabled={isLoadingSummary}
              >
                <X className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            )}
          </div>

          {displayStats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayStats.map((stat) => (
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