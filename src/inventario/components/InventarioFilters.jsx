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
import { Filter, Search, X } from "lucide-react";

const InventarioFilters = memo(
  ({
    filtroCodigoActivo,
    setFiltroCodigoActivo,
    filtroInventariador,
    setFiltroInventariador,
    filtroCarnet,
    setFiltroCarnet,
    filtroEstado,
    setFiltroEstado,
    onFilter,
    onClearFilters,
  }) => {
    const isFilterActive =
      !!filtroCodigoActivo ||
      !!filtroInventariador ||
      !!filtroCarnet ||
      filtroEstado !== "all";

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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filtroCodigoActivo">Código Activo</Label>
              <Input
                id="filtroCodigoActivo"
                placeholder="Buscar por código activo..."
                value={filtroCodigoActivo}
                onChange={(e) => setFiltroCodigoActivo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtroInventariador">Inventariador</Label>
              <Input
                id="filtroInventariador"
                placeholder="Buscar por inventariador..."
                value={filtroInventariador}
                onChange={(e) => setFiltroInventariador(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtroCarnet">Carnet del Responsable</Label>
              <Input
                id="filtroCarnet"
                placeholder="Buscar por carnet..."
                value={filtroCarnet}
                onChange={(e) => setFiltroCarnet(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtroEstado">Estado</Label>
              <Select
                value={filtroEstado}
                onValueChange={(v) => {
                  setFiltroEstado(v);
                }}
              >
                <SelectTrigger id="filtroEstado" className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="revisado">Revisados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-end">
              <Button onClick={onFilter} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
);

InventarioFilters.displayName = "InventarioFilters";
export default InventarioFilters;
