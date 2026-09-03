import { ArrowLeft, Edit, Filter, Loader2, Package, Search, X } from "lucide-react";
import { buildDenominacion } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DataPagination from "@/components/ui/data-pagination";
import UbicacionFilters from "./UbicacionFilters";
import { InventarioEditModal } from "./InventarioModals";

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
  getAmbienteName,
  getResponsableName,
  onEdit,
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
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-xl font-bold">Búsqueda Rápida de Activos</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Criterios de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="searchCarnet">C.I. Responsable</Label>
              <Input
                id="searchCarnet"
                placeholder="Ingrese C.I...."
                value={searchCarnet}
                onChange={(e) => setSearchCarnet(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="searchNombre">Nombre / Apellido Responsable</Label>
              <Input
                id="searchNombre"
                placeholder="Ingrese nombre o apellido..."
                value={searchNombre}
                onChange={(e) => setSearchNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="text-sm font-medium mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              Filtrar por Ubicación (opcional)
            </div>
            <UbicacionFilters
              filtroCiudad={filtroCiudad}
              setFiltroCiudad={setFiltroCiudad}
              filtroInmueble={filtroInmueble}
              setFiltroInmueble={setFiltroInmueble}
              filtroNivel={filtroNivel}
              setFiltroNivel={setFiltroNivel}
              filtroAmbiente={filtroAmbiente}
              setFiltroAmbiente={setFiltroAmbiente}
              ciudadOptions={ciudadOptions}
              inmuebleOptionsByCiudad={inmuebleOptionsByCiudad}
              nivelOptionsByInmueble={nivelOptionsByInmueble}
              ambienteOptionsByNivel={ambienteOptionsByNivel}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClearSearch} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
            <Button onClick={onSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Resultados ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No se encontraron activos con los criterios especificados.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código Activo</TableHead>
                      <TableHead>Rubro</TableHead>
                      <TableHead>Tipo Rubro</TableHead>
                      <TableHead>Denominación</TableHead>
                      <TableHead>Ambiente</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead>C.I.</TableHead>
                      <TableHead>Estado Inv.</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.codigoActivoInterno}>
                        <TableCell className="font-mono text-xs">
                          {row._codigoActivo || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{row._rubro}</TableCell>
                        <TableCell className="text-xs">{row._tipoRubro}</TableCell>
                        <TableCell className="text-xs">
                          {buildDenominacion(row)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {getAmbienteName(row.codigoAmbiente)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getResponsableName(row.cirun)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.cirun || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              row.estadoinventario === "REVISADO"
                                ? "bg-green-100 text-green-800"
                                : row.estadoinventario === "INVENTARIADO"
                                ? "bg-blue-100 text-blue-800"
                                : row.estadoinventario === "EN PROCESO"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {row.estadoinventario || "PENDIENTE"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(row)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataPagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <InventarioEditModal
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editActivo={editActivo}
        setEditActivo={setEditActivo}
        editForm={editForm}
        handleEditChange={onEditChange}
        handleEditSelectChange={onEditSelectChange}
        isSaving={isSaving}
        handleEditSave={onRegistrar}
        ambientes={ambientes}
        rubroFromTipo={rubroFromTipo}
        saveText="REGISTRAR"
      />
    </div>
  );
};

export default InventarioBusqueda;