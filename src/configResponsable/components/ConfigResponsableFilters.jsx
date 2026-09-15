import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, X, Search } from "lucide-react";

const ConfigResponsableFilters = memo(({
  filters,
  hasActiveFilters,
  onFilterChange,
  onSearch,
  onClearFilters,
}) => {
  const fields = [
    { id: "carnet", label: "Carnet", placeholder: "Buscar por CI..." },
    { id: "nombre", label: "Nombre", placeholder: "Buscar por nombre..." },
    { id: "paterno", label: "Apellido Paterno", placeholder: "Buscar por apellido paterno..." },
    { id: "cargo", label: "Cargo", placeholder: "Buscar por cargo..." },
  ];

  return (
    <Card>
      <CardHeader className="pb-3 p-3 sm:p-6 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {fields.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <Label htmlFor={f.id} className="text-xs sm:text-sm">
                  {f.label}
                </Label>
                <Input id={f.id} placeholder={f.placeholder} value={filters[f.id] || ""} onChange={(e) => onFilterChange(f.id, e.target.value)} className="h-11 sm:h-9 text-sm" />
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t">
            <Button onClick={onSearch} className="w-full sm:w-auto min-h-11 sm:min-h-9">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={onClearFilters} className="w-full sm:w-auto min-h-11 sm:min-h-9">
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

ConfigResponsableFilters.displayName = "ConfigResponsableFilters";
export default ConfigResponsableFilters;