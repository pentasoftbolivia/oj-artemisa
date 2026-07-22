import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LoadingSpinner from "@/components/ui/loading-spinner";
import {
  Plus,
  Edit,
  Trash2,
  ClipboardList,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCatalogos } from "@/hooks/useCatalogos";

import {
  fetchAsignaciones,
  addAsignacion,
  updateAsignacion,
  deleteAsignacion,
} from "@/store/asignaciones/asignacionesThunks";
import {
  selectSortedAsignaciones,
  selectAsignacionesLoading,
  selectAsignacionesError,
} from "@/store/asignaciones/asignacionesSlice";

import ComboboxField from "@/components/ui/combobox-field";
import AsignacionesForm from "./AsignacionesForm";

const INITIAL_FILTERS = {
  search: "",
  activoId: "",
  funcionarioId: "",
};

const MESSAGES = {
  success: {
    created: "La asignación ha sido guardada exitosamente.",
    updated: "La asignación se ha actualizado correctamente.",
    deleted: "La asignación se ha eliminado correctamente.",
  },
  error: {
    loading: "Error al cargar asignaciones",
    save: "Fallo al guardar la asignación",
    delete: "Error al eliminar la asignación",
    unknown: "Error desconocido",
  },
  empty: {
    noData: "Selecciona un filtro para buscar asignaciones",
    noResults: "No se encontraron asignaciones que coincidan con los filtros",
    adjustFilters: "Intenta ajustar los filtros de búsqueda",
  },
  placeholders: {
    search:
      "Buscar por CI, nombres y apellidos de funcionario o código patrimonial...",
    activo: "Seleccionar activo",
    funcionario: "Seleccionar funcionario",
  },
};

const EMPTY_ARRAY = [];

const AsignacionesList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const asignaciones = useSelector(selectSortedAsignaciones);
  const isLoading = useSelector(selectAsignacionesLoading);
  const error = useSelector(selectAsignacionesError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsignacion, setEditingAsignacion] = useState(null);
  const [asignacionToDelete, setAsignacionToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });

  const { data: catalogos, loading: fkLoading } = useCatalogos([
    {
      table: "activos_fijos",
      columns: "id, codigo_patrimonial, denominacion, tipo_activo_id, estado",
    },
    { table: "tipos_activo", columns: "id, nombre, tipo_padre_id" },
    {
      table: "funcionarios",
      columns:
        "id, nombres, apellido_paterno, apellido_materno, cargo_id, numero_documento",
    },
    { table: "entidades", columns: "id, nombre" },
    { table: "unidades", columns: "id, nombre" },
    { table: "ubicaciones", columns: "id, nombre, municipio_id" },
    { table: "municipios", columns: "id, nombre" },
    { table: "cargos" },
  ]);

  const activos = catalogos.activos_fijos || EMPTY_ARRAY;
  const funcionarios = catalogos.funcionarios || EMPTY_ARRAY;
  const entidades = catalogos.entidades || EMPTY_ARRAY;
  const unidades = catalogos.unidades || EMPTY_ARRAY;
  const ubicaciones = catalogos.ubicaciones || EMPTY_ARRAY;
  const municipios = catalogos.municipios || EMPTY_ARRAY;
  const tiposActivo = catalogos.tipos_activo || EMPTY_ARRAY;
  const cargos = catalogos.cargos || EMPTY_ARRAY;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isFetchingData, setIsFetchingData] = useState(false);

  useEffect(() => {
    const hasFilters =
      filters.search || filters.activoId || filters.funcionarioId;
    if (!hasFilters) return;
    if (isFetchingData) return;
    setIsFetchingData(true);
    dispatch(fetchAsignaciones());
  }, [filters, isFetchingData, dispatch]);

  const handleAdd = useCallback(() => {
    setEditingAsignacion(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((asignacion) => {
    setEditingAsignacion(asignacion);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((asignacion) => {
    setAsignacionToDelete(asignacion);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (asignacionToDelete) {
      dispatch(deleteAsignacion(asignacionToDelete.id));
      setIsDeleteDialogOpen(false);
      setAsignacionToDelete(null);
      toast({
        title: "¡Éxito!",
        description: MESSAGES.success.deleted,
        variant: "default",
      });
    }
  }, [asignacionToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => {
    setIsFormOpen(false);
    setEditingAsignacion(null);
  }, []);

  const handleFilterChange = useCallback((filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setCurrentPage(1);
  }, []);

  const activosMap = useMemo(
    () =>
      activos.reduce((acc, a) => {
        acc[a.id] = `${a.denominacion}`;
        return acc;
      }, {}),
    [activos],
  );

  const codigoPatrimonialMap = useMemo(
    () =>
      activos.reduce((acc, a) => {
        acc[a.id] = a.codigo_patrimonial;
        return acc;
      }, {}),
    [activos],
  );

  const getActivoName = useCallback(
    (id) => (id ? activosMap[id] || `ID: ${id}` : "—"),
    [activosMap],
  );

  const getCodigoPatrimonialByActivoId = useCallback(
    (id) => (id ? codigoPatrimonialMap[id] || `ID: ${id}` : "—"),
    [codigoPatrimonialMap],
  );

  const funcionariosMap = useMemo(
    () =>
      funcionarios.reduce((acc, f) => {
        acc[f.id] =
          `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno || ""}`.trim();
        return acc;
      }, {}),
    [funcionarios],
  );

  const getFuncionarioName = useCallback(
    (id) => (id ? funcionariosMap[id] || `ID: ${id}` : "—"),
    [funcionariosMap],
  );

  const funcionarioDocMap = useMemo(
    () =>
      funcionarios.reduce((acc, f) => {
        acc[f.id] = f.numero_documento || "";
        return acc;
      }, {}),
    [funcionarios],
  );

  const getFuncionarioDoc = useCallback(
    (id) => (id ? funcionarioDocMap[id] || "" : ""),
    [funcionarioDocMap],
  );

  const entidadesMap = useMemo(
    () =>
      entidades.reduce((acc, e) => {
        acc[e.id] = e.nombre;
        return acc;
      }, {}),
    [entidades],
  );

  const getEntidadName = useCallback(
    (id) => (id ? entidadesMap[id] || `ID: ${id}` : "—"),
    [entidadesMap],
  );

  const unidadesMap = useMemo(
    () =>
      unidades.reduce((acc, u) => {
        acc[u.id] = u.nombre;
        return acc;
      }, {}),
    [unidades],
  );

  const getUnidadName = useCallback(
    (id) => (id ? unidadesMap[id] || `ID: ${id}` : "—"),
    [unidadesMap],
  );

  const ubicacionesMap = useMemo(
    () =>
      ubicaciones.reduce((acc, u) => {
        acc[u.id] = u.nombre;
        return acc;
      }, {}),
    [ubicaciones],
  );

  const getUbicacionName = useCallback(
    (id) => (id ? ubicacionesMap[id] || `ID: ${id}` : "—"),
    [ubicacionesMap],
  );

  const municipiosMap = useMemo(
    () =>
      municipios.reduce((acc, m) => {
        acc[m.id] = m.nombre;
        return acc;
      }, {}),
    [municipios],
  );

  const ubicacionToMunicipioMap = useMemo(
    () =>
      ubicaciones.reduce((acc, u) => {
        if (u.municipio_id) {
          acc[u.id] = municipiosMap[u.municipio_id] || "";
        }
        return acc;
      }, {}),
    [ubicaciones, municipiosMap],
  );

  const getMunicipioByUbicacionId = useCallback(
    (ubicacionId) =>
      ubicacionId ? ubicacionToMunicipioMap[ubicacionId] || "—" : "—",
    [ubicacionToMunicipioMap],
  );

  const tipoActivoMap = useMemo(
    () =>
      tiposActivo.reduce((acc, t) => {
        acc[t.id] = t.nombre;
        return acc;
      }, {}),
    [tiposActivo],
  );

  const activoToTipoMap = useMemo(
    () =>
      activos.reduce((acc, a) => {
        if (a.tipo_activo_id) {
          acc[a.id] = tipoActivoMap[a.tipo_activo_id] || "";
        }
        return acc;
      }, {}),
    [activos, tipoActivoMap],
  );

  const getTipoActivoByActivoId = useCallback(
    (activoId) => (activoId ? activoToTipoMap[activoId] || "—" : "—"),
    [activoToTipoMap],
  );

  const tipoPadreMap = useMemo(
    () =>
      tiposActivo.reduce((acc, t) => {
        if (t.tipo_padre_id) {
          acc[t.id] = tipoActivoMap[t.tipo_padre_id] || "";
        }
        return acc;
      }, {}),
    [tiposActivo, tipoActivoMap],
  );

  const activoToTipoPadreMap = useMemo(
    () =>
      activos.reduce((acc, a) => {
        if (a.tipo_activo_id && tipoPadreMap[a.tipo_activo_id]) {
          acc[a.id] = tipoPadreMap[a.tipo_activo_id];
        }
        return acc;
      }, {}),
    [activos, tipoPadreMap],
  );

  const getTipoByActivoId = useCallback(
    (activoId) => (activoId ? activoToTipoPadreMap[activoId] || "—" : "—"),
    [activoToTipoPadreMap],
  );

  const cargosMap = useMemo(
    () =>
      cargos.reduce((acc, c) => {
        acc[c.id] = c.nombre;
        return acc;
      }, {}),
    [cargos],
  );

  const funcionarioToCargoMap = useMemo(
    () =>
      funcionarios.reduce((acc, f) => {
        if (f.cargo_id) {
          acc[f.id] = cargosMap[f.cargo_id] || "";
        }
        return acc;
      }, {}),
    [funcionarios, cargosMap],
  );

  const getCargoByFuncionarioId = useCallback(
    (funcionarioId) =>
      funcionarioId ? funcionarioToCargoMap[funcionarioId] || "—" : "—",
    [funcionarioToCargoMap],
  );

  const activoEstadoMap = useMemo(
    () =>
      activos.reduce((acc, a) => {
        if (a.estado) {
          acc[a.id] = a.estado;
        }
        return acc;
      }, {}),
    [activos],
  );

  const getEstadoByActivoId = useCallback(
    (activoId) => (activoId ? activoEstadoMap[activoId] || "ACTIVO" : "ACTIVO"),
    [activoEstadoMap],
  );

  const hasActiveFilters =
    filters.search || filters.activoId || filters.funcionarioId;

  const filteredAsignaciones = useMemo(() => {
    if (!hasActiveFilters) return [];
    return asignaciones.filter((a) => {
      const activoNombre = activosMap[a.activoId] || "";
      const funcNombre = getFuncionarioName(a.funcionarioId);
      const funcDoc = getFuncionarioDoc(a.funcionarioId);
      const searchStr =
        `${activoNombre} ${funcNombre} ${funcDoc}`.toLowerCase();
      const searchMatch =
        !filters.search || searchStr.includes(filters.search.toLowerCase());

      const activoMatch =
        !filters.activoId || a.activoId?.toString() === filters.activoId;

      const funcionarioMatch =
        !filters.funcionarioId ||
        a.funcionarioId?.toString() === filters.funcionarioId;

      return searchMatch && activoMatch && funcionarioMatch;
    });
  }, [
    asignaciones,
    filters,
    hasActiveFilters,
    activosMap,
    getFuncionarioName,
    getFuncionarioDoc,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredAsignaciones.length / pageSize)),
    [filteredAsignaciones.length, pageSize],
  );

  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const paginatedAsignaciones = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAsignaciones.slice(start, start + pageSize);
  }, [filteredAsignaciones, safeCurrentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const getPageNumbers = useCallback(() => {
    const pages = [];
    const total = totalPages;
    const current = safeCurrentPage;

    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const handleSubmit = useCallback(
    async (asignacionData) => {
      const action = editingAsignacion
        ? updateAsignacion({
            id: editingAsignacion.id,
            updatedAsignacion: asignacionData,
          })
        : addAsignacion(asignacionData);

      try {
        await dispatch(action).unwrap();
        toast({
          title: "¡Éxito!",
          description: editingAsignacion
            ? MESSAGES.success.updated
            : MESSAGES.success.created,
          variant: "default",
        });
        handleCancel();
        return true;
      } catch (error) {
        console.error("Error saving asignacion:", error);
        toast({
          title: "Error",
          description: `${MESSAGES.error.save}: ${
            error.message || MESSAGES.error.unknown
          }`,
          variant: "destructive",
        });
        return false;
      }
    },
    [dispatch, editingAsignacion, toast, handleCancel],
  );

  if (isFetchingData && isLoading && asignaciones.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-red-600 text-white text-center p-6 rounded-lg">
        <p className="text-lg font-medium">{MESSAGES.error.loading}</p>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asignaciones</h1>
          <p className="text-muted-foreground">
            Administra las asignaciones de activos a funcionarios (Usa los
            filtros para buscar información)
          </p>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            {/*             <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva
            </Button>
 */}{" "}
          </DialogTrigger>
          <DialogContent
            className="sm:max-w-[700px]"
            onInteractOutside={(e) => {
              e.preventDefault();
              handleCancel();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingAsignacion ? "Editar Asignación" : "Nueva Asignación"}
              </DialogTitle>
              <DialogDescription>
                {editingAsignacion
                  ? "Modifica los datos de la asignación"
                  : "Ingresa la información de la nueva asignación"}
              </DialogDescription>
            </DialogHeader>
            {isFormOpen && (
              <AsignacionesForm
                asignacionToEdit={editingAsignacion}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                activos={activos}
                funcionarios={funcionarios}
                entidades={entidades}
                unidades={unidades}
                ubicaciones={ubicaciones}
                loadingFK={fkLoading}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto h-7 px-2 text-muted-foreground hover:text-foreground"
                title="Limpiar filtros"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder={MESSAGES.placeholders.search}
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>

            <ComboboxField
              label="Activo"
              value={filters.activoId}
              onValueChange={(value) => handleFilterChange("activoId", value)}
              options={activos.map((a) => ({
                value: a.id.toString(),
                label: a.codigo_patrimonial,
              }))}
              placeholder={MESSAGES.placeholders.activo}
              searchPlaceholder="Buscar activo..."
            />

            <ComboboxField
              label="Funcionario"
              value={filters.funcionarioId}
              onValueChange={(value) =>
                handleFilterChange("funcionarioId", value)
              }
              options={funcionarios.map((f) => ({
                value: f.id.toString(),
                label: `${f.nombres} ${f.apellido_paterno}`,
              }))}
              placeholder={MESSAGES.placeholders.funcionario}
              searchPlaceholder="Buscar funcionario..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Lista de Asignaciones
          </CardTitle>
          <CardDescription>
            Todas las asignaciones registradas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Activo</TableHead>
                  <TableHead>Código Patrimonial</TableHead>
                  <TableHead>Descripción Activo</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Tipo Grupo</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Ubicación Actual</TableHead>
                  <TableHead>Estado</TableHead>
                  {/* <TableHead className="text-center">Acciones</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAsignaciones.length > 0 ? (
                  paginatedAsignaciones.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">
                        {a.activoId}
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">
                        {getCodigoPatrimonialByActivoId(a.activoId)}
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">
                        {getActivoName(a.activoId)}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[150px]">
                        {getTipoByActivoId(a.activoId)}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[150px]">
                        {getTipoActivoByActivoId(a.activoId)}
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal break-words max-w-[100px]">
                        {getFuncionarioName(a.funcionarioId)}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[180px]">
                        {getCargoByFuncionarioId(a.funcionarioId)}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[100px]">
                        {getEntidadName(a.entidadId)}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[180px]">
                        {getMunicipioByUbicacionId(a.ubicacionId)} -{" "}
                        {getUbicacionName(a.ubicacionId)} - {a.nivel} -{" "}
                        {getUnidadName(a.unidadId)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (getEstadoByActivoId(a.activoId) || "ACTIVO") ===
                            "ACTIVO"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            getEstadoByActivoId(a.activoId) === "BAJA"
                              ? "bg-gray-100 text-gray-600 hover:bg-gray-100"
                              : ""
                          }
                        >
                          {getEstadoByActivoId(a.activoId) || "ACTIVO"}
                        </Badge>
                      </TableCell>
                      {/*                       <TableCell className="text-right">
                        <div className="flex space-x-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(a)}
                            title="Editar asignación"
                            className="text-yellow-500 hover:text-yellow-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(a)}
                            title="Eliminar asignación"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell> */}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <ClipboardList className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">
                        {hasActiveFilters
                          ? MESSAGES.empty.noResults
                          : MESSAGES.empty.noData}
                      </p>
                      <p className="text-sm mt-1">
                        {hasActiveFilters ? MESSAGES.empty.adjustFilters : ""}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {filteredAsignaciones.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Mostrar</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(v) => handlePageSizeChange(Number(v))}
                >
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
                <span>por página</span>
              </div>

              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>
                  {(safeCurrentPage - 1) * pageSize + 1}
                  {" \u2014 "}
                  {Math.min(
                    safeCurrentPage * pageSize,
                    filteredAsignaciones.length,
                  )}
                  {" de "}
                  {filteredAsignaciones.length} registros
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  title="Primera p\u00E1gina"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  title="P\u00E1gina anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {getPageNumbers().map((page, idx) =>
                  page === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-muted-foreground"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={safeCurrentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ),
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  title="P\u00E1gina siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="\u00DAltima p\u00E1gina"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Está seguro de eliminar esta asignación?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. La asignación ID "
              {asignacionToDelete?.id}" será eliminada permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AsignacionesList;
