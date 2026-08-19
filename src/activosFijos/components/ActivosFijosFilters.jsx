import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ComboboxField from "@/components/ui/combobox-field";
import { Filter, X, Search, Loader2 } from "lucide-react";

const ActivosFijosFilters = memo(({
  filters,
  onFilterChange,
  onSearch,
  onClearFilters,
  rubroOptions,
  ciudadOptions,
  inmuebleOptionsByCiudad,
  nivelOptionsByInmueble,
  ambienteOptionsByNivel,
  isLoading
}) => {
  const isFilterActive =
    filters.search ||
    filters.rubro ||
    filters.carnet ||
    filters.ciudad ||
    filters.ambiente ||
    filters.inmueble ||
    filters.nivel;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
        {isFilterActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            title="Limpiar filtros"
            className="h-8"
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Fila 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder="Código activo, denominación..."
                value={filters.search}
                onChange={(e) => onFilterChange("search", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carnet">Carnet</Label>
              <Input
                id="carnet"
                placeholder="Buscar por CI..."
                value={filters.carnet}
                onChange={(e) => onFilterChange("carnet", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <ComboboxField
                label="Rubro"
                value={filters.rubro}
                onValueChange={(val) => onFilterChange("rubro", val)}
                options={rubroOptions}
                placeholder="Seleccionar rubro..."
                searchPlaceholder="Buscar rubro..."
                emptyMessage="Sin resultados"
              />
            </div>
          </div>
          
          {/* Fila 2 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <ComboboxField
                label="Ciudad"
                value={filters.ciudad}
                onValueChange={(val) => onFilterChange("ciudad", val)}
                options={ciudadOptions}
                placeholder="Seleccionar ciudad..."
                searchPlaceholder="Buscar ciudad..."
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="space-y-2">
              <ComboboxField
                label="Inmueble"
                value={filters.inmueble}
                onValueChange={(val) => onFilterChange("inmueble", val)}
                options={inmuebleOptionsByCiudad}
                placeholder="Seleccionar inmueble..."
                searchPlaceholder="Buscar inmueble..."
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="space-y-2">
              <ComboboxField
                label="Nivel"
                value={filters.nivel}
                onValueChange={(val) => onFilterChange("nivel", val)}
                options={nivelOptionsByInmueble}
                placeholder="Seleccionar nivel..."
                searchPlaceholder="Buscar nivel..."
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="space-y-2">
              <ComboboxField
                label="Ambiente"
                value={filters.ambiente}
                onValueChange={(val) => onFilterChange("ambiente", val)}
                options={ambienteOptionsByNivel}
                placeholder="Seleccionar ambiente..."
                searchPlaceholder="Buscar ambiente..."
                emptyMessage="Sin resultados"
                wrapText
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button onClick={onSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
            {isFilterActive ? (
              <Button variant="outline" onClick={onClearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ActivosFijosFilters.displayName = "ActivosFijosFilters";
export default ActivosFijosFilters;
