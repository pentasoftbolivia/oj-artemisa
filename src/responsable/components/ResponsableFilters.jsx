import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ComboboxField from "@/components/ui/combobox-field";
import { Filter, X, Search, Loader2 } from "lucide-react";

const ResponsableFilters = memo(({
  filters,
  hasActiveFilters,
  onFilterChange,
  onSearch,
  onClearFilters,
  messages,
  ciudadOptions,
  inmuebleOptionsByCiudad,
  nivelOptionsByInmueble,
  ambienteOptionsByNivel,
  isSearching,
  isLoadingCatalogos
}) => {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder={messages.placeholders.search}
                value={filters.search}
                onChange={(e) => onFilterChange("search", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="carnet">Carnet</Label>
              <Input
                id="carnet"
                placeholder={messages.placeholders.carnet}
                value={filters.carnet}
                onChange={(e) => onFilterChange("carnet", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ComboboxField
              label="Ciudad"
              value={filters.ciudad}
              onValueChange={(val) => onFilterChange("ciudad", val)}
              options={ciudadOptions}
              placeholder="Seleccionar ciudad..."
              searchPlaceholder="Buscar ciudad..."
              emptyMessage="Sin resultados"
              loading={isLoadingCatalogos}
              disabled={isSearching}
            />
            <ComboboxField
              label="Inmueble"
              value={filters.inmueble}
              onValueChange={(val) => onFilterChange("inmueble", val)}
              options={inmuebleOptionsByCiudad}
              placeholder="Seleccionar inmueble..."
              searchPlaceholder="Buscar inmueble..."
              emptyMessage="Sin resultados"
              loading={isLoadingCatalogos}
              disabled={isSearching}
            />
            <ComboboxField
              label="Nivel"
              value={filters.nivel}
              onValueChange={(val) => onFilterChange("nivel", val)}
              options={nivelOptionsByInmueble}
              placeholder="Seleccionar nivel..."
              searchPlaceholder="Buscar nivel..."
              emptyMessage="Sin resultados"
              loading={isLoadingCatalogos}
              disabled={isSearching}
            />
            <ComboboxField
              label="Ambiente"
              value={filters.ambiente}
              onValueChange={(val) => onFilterChange("ambiente", val)}
              options={ambienteOptionsByNivel}
              placeholder="Seleccionar ambiente..."
              searchPlaceholder="Buscar ambiente..."
              emptyMessage="Sin resultados"
              loading={isLoadingCatalogos}
              disabled={isSearching}
              wrapText
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button onClick={onSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
            {hasActiveFilters || filters.search || filters.carnet ? (
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

ResponsableFilters.displayName = "ResponsableFilters";
export default ResponsableFilters;