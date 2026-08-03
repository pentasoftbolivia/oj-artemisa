import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ComboboxField from "@/components/ui/combobox-field";
import { Filter, X, Search } from "lucide-react";

const AsignacionesFilters = memo(({
  filters,
  hasActiveFilters,
  rubros,
  estados,
  onFilterChange,
  onClearFilters
}) => {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
        {hasActiveFilters ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="searchFuncionario">Buscar por Funcionario</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="searchFuncionario"
                placeholder="CI, nombres o apellidos..."
                className="pl-8"
                value={filters.searchFuncionario}
                onChange={(e) =>
                  onFilterChange("searchFuncionario", e.target.value)
                }
              />
            </div>
          </div>

          <ComboboxField
            label="Buscar por Rubro"
            value={filters.searchGrupo}
            onValueChange={(value) =>
              onFilterChange("searchGrupo", value)
            }
            options={[
              { value: "__todos__", label: "Todos los grupos" },
              ...rubros.map((r) => ({
                value: r.descripcionrubroact,
                label: r.descripcionrubroact,
              })),
            ]}
            placeholder="Seleccionar grupo"
            searchPlaceholder="Buscar grupo..."
          />

          <div className="space-y-2">
            <Label htmlFor="searchActivo">Buscar por Activo</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="searchActivo"
                placeholder="Código, denominación o serie..."
                className="pl-8"
                value={filters.searchActivo}
                onChange={(e) =>
                  onFilterChange("searchActivo", e.target.value)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estado">Buscar por Estado</Label>
            <Select
              value={filters.estado}
              onValueChange={(value) => onFilterChange("estado", value)}
            >
              <SelectTrigger id="estado">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {estados.map((est) => (
                  <SelectItem key={est} value={est}>
                    {est}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AsignacionesFilters.displayName = "AsignacionesFilters";
export default AsignacionesFilters;
