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
  { value: "BUENO", label: "BUENO" },
  { value: "REGULAR", label: "REGULAR" },
  { value: "MALO", label: "MALO" },
];

const ESTADO_ALTA_BAJA_OPTIONS = [
  { value: "TODOS", label: "Todos" },
  { value: "ALTA", label: "Alta" },
  { value: "BAJA", label: "Baja" },
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
    Boolean(filters.inventariador);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="codigoActivo">Código Activo</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="codigoActivo"
                placeholder="Ej: 12345 o OJ-02-12345"
                className="pl-8"
                value={filters.codigoActivo}
                onChange={(e) => onFilterChange("codigoActivo", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ubicacion">Ubicación</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="ubicacion"
                placeholder="Ciudad / Inmueble / Nivel / Ambiente"
                className="pl-8"
                value={filters.ubicacion}
                onChange={(e) => onFilterChange("ubicacion", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="carnet">Carnet</Label>
            <Input
              id="carnet"
              placeholder="CI Responsable"
              value={filters.carnet}
              onChange={(e) => onFilterChange("carnet", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inventariador">Inventariador</Label>
            <Input
              id="inventariador"
              placeholder="Email o nombre"
              value={filters.inventariador}
              onChange={(e) => onFilterChange("inventariador", e.target.value)}
            />
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="estadoConservacion">Estado Conservación</Label>
            <Select value={filters.estadoConservacion} onValueChange={(v) => onFilterChange("estadoConservacion", v)}>
              <SelectTrigger id="estadoConservacion">
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

          <div className="space-y-2">
            <Label htmlFor="estado">Estado (Alta/Baja)</Label>
            <Select value={filters.estado || "TODOS"} onValueChange={(v) => onFilterChange("estado", v)}>
              <SelectTrigger id="estado">
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

          <div className="flex items-end gap-2">
            <Button onClick={onSearch} className="flex-1">
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
            <Button variant="outline" onClick={onClearFilters} disabled={!hasActive} className="flex-1">
              <X className="mr-2 h-4 w-4" />
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
