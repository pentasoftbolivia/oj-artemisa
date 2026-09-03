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
import { Filter, Search, X, Loader2 } from "lucide-react";
import UbicacionFilters from "./UbicacionFilters";

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
    filtroRevaluo,
    setFiltroRevaluo,
    onFilter,
    onClearFilters,
    filtroCiudad,
    setFiltroCiudad,
    filtroInmueble,
    setFiltroInmueble,
    filtroNivel,
    setFiltroNivel,
    filtroAmbiente,
    setFiltroAmbiente,
    ciudadOptions,
    inmuebleOptionsByCiudad,
    nivelOptionsByInmueble,
    ambienteOptionsByNivel,
    isLoading,
  }) => {
    const isFilterActive =
      !!filtroCodigoActivo ||
      !!filtroInventariador ||
      !!filtroCarnet ||
      filtroEstado !== "all" ||
      filtroRevaluo !== "all" ||
      !!filtroCiudad ||
      !!filtroInmueble ||
      !!filtroNivel ||
      !!filtroAmbiente;

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
              <div className="space-y-2">
                <Label htmlFor="filtroRevaluo">Revalúo</Label>
                <Select
                  value={filtroRevaluo}
                  onValueChange={(v) => setFiltroRevaluo(v)}
                >
                  <SelectTrigger id="filtroRevaluo" className="w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="si">SI</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <UbicacionFilters
              ciudad={filtroCiudad}
              setCiudad={setFiltroCiudad}
              inmueble={filtroInmueble}
              setInmueble={setFiltroInmueble}
              nivel={filtroNivel}
              setNivel={setFiltroNivel}
              ambiente={filtroAmbiente}
              setAmbiente={setFiltroAmbiente}
              ciudadOptions={ciudadOptions}
              inmuebleOptionsByCiudad={inmuebleOptionsByCiudad}
              nivelOptionsByInmueble={nivelOptionsByInmueble}
              ambienteOptionsByNivel={ambienteOptionsByNivel}
            />

            <div className="flex items-center gap-2 pt-2 border-t">
              <Button onClick={onFilter} disabled={isLoading}>
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
  },
);

InventarioFilters.displayName = "InventarioFilters";
export default InventarioFilters;
