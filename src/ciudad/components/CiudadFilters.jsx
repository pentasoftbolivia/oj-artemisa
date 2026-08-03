import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

const CiudadFilters = memo(({ filters, onFilterChange, onClearFilters }) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              placeholder="Nombre o código de ciudad..."
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
            />
          </div>
          <div className="space-y-2 flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="w-full md:w-auto"
              disabled={!filters.search}
            >
              <X className="mr-2 h-4 w-4" />
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CiudadFilters.displayName = "CiudadFilters";
export default CiudadFilters;
