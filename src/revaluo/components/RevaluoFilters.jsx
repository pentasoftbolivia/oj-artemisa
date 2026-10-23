import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";
import ComboboxField from "@/components/ui/combobox-field";

const ESTADO_CONSERVACION_OPTIONS = [
  { value: "TODOS", label: "Todos" },
  { value: "NUEVO", label: "NUEVO" },
  { value: "BUENO", label: "BUENO" },
  { value: "REGULAR", label: "REGULAR" },
  { value: "MALO", label: "MALO" },
];

const ESTADO_ALTA_BAJA_OPTIONS = [
  { value: "TODOS", label: "Todos" },
  { value: "ALTA", label: "Alta" },
  { value: "BAJA", label: "Baja" },
];

const FOTOS_OPTIONS = [
  { value: "TODOS", label: "Todas" },
  { value: "SIN_FOTOS", label: "Sin fotos (0)" },
  { value: "UNA_FOTO_O_MAS", label: "1 foto o más" },
];

const COTIZACION_OPTIONS = [
  { value: "TODOS", label: "Todas" },
  { value: "CON_COTIZACION", label: "Con cotización" },
  { value: "SIN_COTIZACION", label: "Sin cotización" },
];

const PRECIO_OPTIONS = [
  { value: "TODOS", label: "Todos" },
  { value: "CON_PRECIO", label: "Con Precio Revalúo" },
  { value: "SIN_PRECIO", label: "Sin Precio Revalúo" },
];

const RevaluoFilters = memo(({ filters, onFilterChange, onClearFilters, onSearch, rubroOptions = [], tipoRubroOptions = [] }) => {
  const hasActive =
    Boolean(filters.codigoActivo) ||
    (filters.estadoConservacion && filters.estadoConservacion !== "TODOS") ||
    (filters.estado && filters.estado !== "TODOS") ||
    Boolean(filters.ubicacion) ||
    Boolean(filters.carnet) ||
    (filters.rubro && filters.rubro !== "TODOS") ||
    (filters.tipoRubro && filters.tipoRubro !== "TODOS") ||
    (filters.fotos && filters.fotos !== "TODOS") ||
    (filters.cotizacion && filters.cotizacion !== "TODOS") ||
    (filters.precio && filters.precio !== "TODOS");

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-3 sm:pt-6 p-3 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="codigoActivo" className="text-xs sm:text-sm">
              Código Activo
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-3 sm:top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="codigoActivo" placeholder="Ej: 12345 o OJ-02-12345" className="pl-8 h-11 sm:h-9 text-sm" value={filters.codigoActivo} onChange={(e) => onFilterChange("codigoActivo", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ubicacion" className="text-xs sm:text-sm">
              Ubicación
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-3 sm:top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="ubicacion" placeholder="Ciudad / Inmueble / Nivel / Ambiente" className="pl-8 h-11 sm:h-9 text-sm" value={filters.ubicacion} onChange={(e) => onFilterChange("ubicacion", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="carnet" className="text-xs sm:text-sm">
              Carnet
            </Label>
            <Input id="carnet" placeholder="CI Responsable" className="h-11 sm:h-9 text-sm" value={filters.carnet} onChange={(e) => onFilterChange("carnet", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fotos" className="text-xs sm:text-sm">
              Cantidad de fotos
            </Label>
            <Select value={filters.fotos || "TODOS"} onValueChange={(v) => onFilterChange("fotos", v)}>
              <SelectTrigger id="fotos" className="h-11 sm:h-9 text-sm">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {FOTOS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">  </Label>
            <ComboboxField
              label="Rubro"
              value={filters.rubro || "TODOS"}
              onValueChange={(v) => onFilterChange("rubro", v)}
              options={[{ value: "TODOS", label: "Todos" }, ...rubroOptions]}
              placeholder="Todos los rubros"
              searchPlaceholder="Buscar rubro..."
              emptyMessage="Sin resultados"
              wrapText
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">  </Label>
            <ComboboxField
              label="Tipo Rubro"
              value={filters.tipoRubro || "TODOS"}
              onValueChange={(v) => onFilterChange("tipoRubro", v)}
              options={[{ value: "TODOS", label: "Todos" }, ...tipoRubroOptions]}
              placeholder="Todos los tipos"
              searchPlaceholder="Buscar tipo rubro..."
              emptyMessage="Sin resultados"
              wrapText
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cotizacion" className="text-xs sm:text-sm">
              Cotización
            </Label>
            <Select value={filters.cotizacion || "TODOS"} onValueChange={(v) => onFilterChange("cotizacion", v)}>
              <SelectTrigger id="cotizacion" className="h-11 sm:h-9 text-sm">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {COTIZACION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="precio" className="text-xs sm:text-sm">
              Precio Revalúo
            </Label>
            <Select value={filters.precio || "TODOS"} onValueChange={(v) => onFilterChange("precio", v)}>
              <SelectTrigger id="precio" className="h-11 sm:h-9 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                {PRECIO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="estadoConservacion" className="text-xs sm:text-sm">
              Estado Conservación
            </Label>
            <Select value={filters.estadoConservacion} onValueChange={(v) => onFilterChange("estadoConservacion", v)}>
              <SelectTrigger id="estadoConservacion" className="h-11 sm:h-9 text-sm">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_CONSERVACION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="estado" className="text-xs sm:text-sm">
              Estado (Alta/Baja)
            </Label>
            <Select value={filters.estado || "TODOS"} onValueChange={(v) => onFilterChange("estado", v)}>
              <SelectTrigger id="estado" className="h-11 sm:h-9 text-sm">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_ALTA_BAJA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button onClick={onSearch} className="w-full sm:w-auto flex-1 sm:flex-none min-h-11 sm:min-h-9">
              <Search className="mr-2 h-4 w-4 shrink-0" />
              Buscar
            </Button>
            <Button variant="outline" onClick={onClearFilters} disabled={!hasActive} className="w-full sm:w-auto flex-1 sm:flex-none min-h-11 sm:min-h-9">
              <X className="mr-2 h-4 w-4 shrink-0" />
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

RevaluoFilters.displayName = "RevaluoFilters";

export default RevaluoFilters;
