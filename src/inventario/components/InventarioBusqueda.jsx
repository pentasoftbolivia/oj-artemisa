import { ArrowLeft, Edit, Filter, Loader2, Package, Search, X } from "lucide-react";
import { buildDenominacion } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataPagination from "@/components/ui/data-pagination";
import UbicacionFilters from "./UbicacionFilters";
import { getRubroFields } from "../constants/inventarioConstants";

const InventarioBusqueda = ({
  onBack,
  searchCarnet,
  setSearchCarnet,
  searchNombre,
  setSearchNombre,
  onSearch,
  onClearSearch,
  isLoading,
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
  rows,
  safeCurrentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  currentUser,
  getAmbienteName,
  getResponsableName,
  onEdit,
  onEnviar,
  isEditOpen,
  setIsEditOpen,
  editActivo,
  setEditActivo,
  editForm,
  onEditChange,
  onEditSelectChange,
  isSaving,
  onRegistrar,
  ambientes,
  rubroFromTipo,
}) => {
  const renderEditFields = () => {
    if (!editActivo) return null;
    const rubroDesc = rubroFromTipo[editActivo.tipoRubroAct] || "";
    const fields = getRubroFields(rubroDesc);

    return fields.map((f) => (
      <div key={f.key} className="space-y-2 min-w-0">
        <Label htmlFor={f.key}>{f.label}</Label>
        <Input
          id={f.key}
          value={editForm[f.key] || ""}
          onChange={onEditChange}
          disabled={isSaving}
          className="break-words"
        />
      </div>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            LISTA DE ACTIVOS POR BUSQUEDA
          </h1>
        </div>
      </div>

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
              <Label htmlFor="searchCarnet">Carnet del Responsable</Label>
              <Input
                id="searchCarnet"
                placeholder="Buscar por carnet..."
                value={searchCarnet}
                onChange={(e) => setSearchCarnet(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="searchNombre">
                Nombres o Apellidos del Responsable
              </Label>
              <Input
                id="searchNombre"
                placeholder="Buscar por nombre o apellido..."
                value={searchNombre}
                onChange={(e) => setSearchNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2 flex items-end gap-2">
              <Button onClick={onSearch} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {isLoading ? "Buscando" : "Buscar"}
              </Button>
              <Button
                variant="outline"
                onClick={onClearSearch}
                disabled={
                  !searchCarnet &&
                  !searchNombre &&
                  !filtroCiudad &&
                  !filtroInmueble &&
                  !filtroNivel &&
                  !filtroAmbiente
                }
              >
                <X className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
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
            className="mt-4"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Resultados de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Activo</TableHead>
                  <TableHead>Rubro</TableHead>
                  <TableHead>Tipo Rubro</TableHead>
                  <TableHead>Descripción del Activo</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>CI</TableHead>
                  {currentUser?.role !== "Usuario" && (
                    <TableHead className="text-center">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((a) => (
                    <TableRow key={a.codigoActivoInterno}>
                      <TableCell className="font-mono text-xs">
                        {a._codigoActivo}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[180px]">
                        {a._rubro}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {a._tipoRubro}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[250px]">
                        {buildDenominacion(a, a._rubro)}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[200px]">
                        {getAmbienteName(a._ambienteKey)}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-normal break-words max-w-[200px]">
                        {getResponsableName(a._ci)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {a._carnetResponsable}
                      </TableCell>
                      {currentUser?.role !== "Usuario" && (
                        <TableCell className="text-right">
                          <div className="flex space-x-1 justify-end">
                            {a.ultimoregistro !== 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(a)}
                                className="text-yellow-500 hover:text-yellow-700"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                EDITAR
                              </Button>
                            )}
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => onEnviar(a)}
                              className={
                                a.ultimoregistro === 0 ||
                                a.estadoinventario === "ENVIADO"
                                  ? "bg-orange-500 hover:bg-orange-600 text-white font-bold"
                                  : "bg-red-600 hover:bg-red-700 text-white font-bold"
                              }
                            >
                              {a.ultimoregistro === 0 ||
                              a.estadoinventario === "ENVIADO"
                                ? "ENVIADO"
                                : "PENDIENTE"}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">
                        {isLoading ? "Cargando..." : "No se encontraron activos"}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {rows.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditOpen(false);
            setEditActivo(null);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-[600px]"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Editar Activo</DialogTitle>
            <DialogDescription>
              Modifica los datos del activo fijo
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto overflow-x-hidden">
            <div className="space-y-4 min-w-0">
              <div className="space-y-2">
                <Label htmlFor="codigoActivo">Código Activo</Label>
                <Input
                  id="codigoActivo"
                  value={editForm.codigoActivo || ""}
                  onChange={undefined}
                  disabled={isSaving}
                  readOnly
                  className="break-words"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigoAmbiente">Ambiente</Label>
                <Select
                  value={editForm.codigoAmbiente}
                  onValueChange={(v) =>
                    onEditSelectChange("codigoAmbiente", v)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar ambiente" />
                  </SelectTrigger>
                  <SelectContent>
                    {ambientes.map((a) => (
                      <SelectItem
                        key={a.codigoambiente}
                        value={String(a.codigoambiente).trim()}
                      >
                        {`${a.codigoambiente} - ${a.ambiente}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rubro">Rubro</Label>
                <Input
                  id="rubro"
                  value={editForm.rubro || ""}
                  onChange={undefined}
                  disabled={isSaving}
                  readOnly
                  className="break-words"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipoRubro">Tipo Rubro</Label>
                <Input
                  id="tipoRubro"
                  value={editForm.tipoRubro || ""}
                  onChange={undefined}
                  disabled={isSaving}
                  readOnly
                  className="break-words"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcionActivo">Descripción del Activo</Label>
              <Textarea
                id="descripcionActivo"
                value={editForm.descripcionActivo || ""}
                onChange={onEditChange}
                disabled={isSaving}
                rows={3}
                className="w-full break-words"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={editForm.observaciones || ""}
                onChange={onEditChange}
                disabled={isSaving}
                rows={2}
                className="w-full break-words"
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Estado de Conservación
              </h3>
              <Select
                value={editForm.estadoConservacion}
                onValueChange={(v) =>
                  onEditSelectChange("estadoConservacion", v)
                }
                disabled={isSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUENO">BUENO</SelectItem>
                  <SelectItem value="REGULAR">REGULAR</SelectItem>
                  <SelectItem value="MALO">MALO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Características
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                <div className="space-y-2">
                  <Label htmlFor="marcamaterial">Marca Material</Label>
                  <Input
                    id="marcamaterial"
                    value={editForm.marcamaterial || ""}
                    onChange={onEditChange}
                    disabled={isSaving}
                    className="break-words"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelo">Modelo</Label>
                  <Input
                    id="modelo"
                    value={editForm.modelo || ""}
                    onChange={onEditChange}
                    disabled={isSaving}
                    className="break-words"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serie">Serie</Label>
                  <Input
                    id="serie"
                    value={editForm.serie || ""}
                    onChange={onEditChange}
                    disabled={isSaving}
                    className="break-words"
                  />
                </div>
              </div>
            </div>

            {editActivo && rubroFromTipo[editActivo.tipoRubroAct] && (
              <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 break-words">
                  Campos específicos: {rubroFromTipo[editActivo.tipoRubroAct]}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                  {renderEditFields()}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false);
                setEditActivo(null);
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={onRegistrar} disabled={isSaving}>
              {isSaving ? "Guardando..." : "REGISTRAR"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventarioBusqueda;