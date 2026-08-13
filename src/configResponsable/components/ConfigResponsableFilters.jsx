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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {fields.map((f) => (
              <div key={f.id} className="space-y-2">
                <Label htmlFor={f.id}>{f.label}</Label>
                <Input
                  id={f.id}
                  placeholder={f.placeholder}
                  value={filters[f.id] || ""}
                  onChange={(e) => onFilterChange(f.id, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button onClick={onSearch}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            {hasActiveFilters ? (
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

ConfigResponsableFilters.displayName = "ConfigResponsableFilters";
export default ConfigResponsableFilters;