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
import DataPagination from "@/components/ui/data-pagination";
import { Plus, Edit, Trash2, Users, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchResponsable,
  addResponsable,
  updateResponsable,
  deleteResponsable,
} from "@/store/responsable/responsableThunks";
import {
  selectSortedResponsable,
  selectResponsableLoading,
  selectResponsableError,
} from "@/store/responsable/responsableSlice";
import ResponsableForm from "./ResponsableForm";

const INITIAL_FILTERS = {
  search: "",
  cargo: "",
};

const MESSAGES = {
  success: {
    created: "El responsable ha sido guardado exitosamente.",
    updated: "El responsable se ha actualizado correctamente.",
    deleted: "El responsable se ha eliminado correctamente.",
  },
  error: {
    loading: "Error al cargar responsables",
    save: "Fallo al guardar el responsable",
    delete: "Error al eliminar el responsable",
    unknown: "Error desconocido",
  },
  empty: {
    noData: "No hay responsables registrados",
    filtered: "No se encontraron responsables que coincidan con los filtros",
    createFirst:
      'Crea tu primer responsable usando el botón "Nuevo Responsable"',
    adjustFilters: "Intenta ajustar los filtros de búsqueda",
  },
  placeholders: {
    search: "Buscar por CI, nombre, apellido o cargo...",
    cargo: "Todos los cargos",
  },
};

const ESTADO_MAP = { 0: "Inactivo", 1: "Activo" };

const ResponsableList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const responsables = useSelector(selectSortedResponsable);
  const isLoading = useSelector(selectResponsableLoading);
  const error = useSelector(selectResponsableError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResponsable, setEditingResponsable] = useState(null);
  const [responsableToDelete, setResponsableToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    dispatch(fetchResponsable());
  }, [dispatch]);

  const handleAdd = useCallback(() => {
    setEditingResponsable(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((responsable) => {
    setEditingResponsable(responsable);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((responsable) => {
    setResponsableToDelete(responsable);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!responsableToDelete) return;
    try {
      await dispatch(deleteResponsable(responsableToDelete.cirun)).unwrap();
      setIsDeleteDialogOpen(false);
      setResponsableToDelete(null);
      toast({
        title: "¡Éxito!",
        description: MESSAGES.success.deleted,
        variant: "default",
      });
    } catch (error) {
      console.error("Error deleting responsable:", error);
      toast({
        title: "Error",
        description: `${MESSAGES.error.delete}: ${error.message || MESSAGES.error.unknown}`,
        variant: "destructive",
      });
    }
  }, [responsableToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => {
    setIsFormOpen(false);
    setEditingResponsable(null);
  }, []);

  const handleFilterChange = useCallback((filterType, value) => {
    setFilters((prev) => ({ ...prev, [filterType]: value }));
  }, []);

  const filteredResponsables = useMemo(
    () =>
      responsables.filter((r) => {
        const searchStr =
          `${r.cirun || ""} ${r.nombre1 || ""} ${r.nombre2 || ""} ${r.paterno || ""} ${r.materno || ""} ${r.cargo || ""}`.toLowerCase();
        const searchMatch =
          !filters.search || searchStr.includes(filters.search.toLowerCase());

        const cargoMatch =
          !filters.cargo ||
          filters.cargo === "all" ||
          (r.cargo || "").trim().toLowerCase() === filters.cargo.toLowerCase();

        return searchMatch && cargoMatch;
      }),
    [responsables, filters],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredResponsables.length / pageSize)),
    [filteredResponsables.length, pageSize],
  );

  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const paginatedResponsables = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredResponsables.slice(start, start + pageSize);
  }, [filteredResponsables, safeCurrentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = useMemo(
    () => filters.search !== "" || filters.cargo !== "",
    [filters],
  );

  const handleSubmit = useCallback(
    async (responsableData) => {
      const action = editingResponsable
        ? updateResponsable({
          cirun: editingResponsable.cirun,
          updatedResponsable: responsableData,
        })
        : addResponsable(responsableData);
      try {
        await dispatch(action).unwrap();
        toast({
          title: "¡Éxito!",
          description: editingResponsable
            ? MESSAGES.success.updated
            : MESSAGES.success.created,
          variant: "default",
        });
        handleCancel();
        return true;
      } catch (error) {
        console.error("Error saving responsable:", error);
        toast({
          title: "Error",
          description: `${MESSAGES.error.save}: ${error.message || MESSAGES.error.unknown}`,
          variant: "destructive",
        });
        return false;
      }
    },
    [dispatch, editingResponsable, toast, handleCancel],
  );

  if (isLoading && responsables.length === 0) {
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
          <h1 className="text-2xl font-bold tracking-tight">Responsables</h1>
          <p className="text-muted-foreground">
            Administra los responsables del sistema
          </p>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
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
                {editingResponsable
                  ? "Editar Responsable"
                  : "Nuevo Responsable"}
              </DialogTitle>
              <DialogDescription>
                {editingResponsable
                  ? "Modifica los datos del responsable"
                  : "Ingresa la información del nuevo responsable"}
              </DialogDescription>
            </DialogHeader>
            <ResponsableForm
              responsableToEdit={editingResponsable}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder={MESSAGES.placeholders.search}
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Select
                value={filters.cargo}
                onValueChange={(value) => handleFilterChange("cargo", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={MESSAGES.placeholders.cargo} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {MESSAGES.placeholders.cargo}
                  </SelectItem>
                  {[...new Set(responsables.map(r => r.cargo?.trim()).filter(Boolean))].sort().map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Responsables
          </CardTitle>
          <CardDescription>
            Todos los responsables registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CI</TableHead>
                  <TableHead>Primer Nombre</TableHead>
                  <TableHead>Segundo Nombre</TableHead>
                  <TableHead>Apellido Paterno</TableHead>
                  <TableHead>Apellido Materno</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Estado Activo</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedResponsables.length > 0 ? (
                  paginatedResponsables.map((r) => (
                    <TableRow key={r.cirun}>
                      <TableCell className="font-medium font-mono text-xs">
                        {r.cirun}
                      </TableCell>
                      <TableCell>{r.nombre1?.trim() || "—"}</TableCell>
                      <TableCell>{r.nombre2?.trim() || "—"}</TableCell>
                      <TableCell>{r.paterno?.trim() || "—"}</TableCell>
                      <TableCell>{r.materno?.trim() || "—"}</TableCell>
                      <TableCell>{r.cargo?.trim() || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.registroActivo === 1 ? "default" : "secondary"
                          }
                        >
                          {ESTADO_MAP[r.registroActivo] ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex space-x-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(r)}
                            title="Editar responsable"
                            className="text-yellow-500 hover:text-yellow-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(r)}
                            title="Eliminar responsable"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Users className="mx-auto h-12 w-12 opacity-20 mb-2" />
                      <p className="text-lg font-medium">
                        {filters.search || filters.estado
                          ? MESSAGES.empty.filtered
                          : MESSAGES.empty.noData}
                      </p>
                      <p className="text-sm mt-1">
                        {filters.search || filters.estado
                          ? MESSAGES.empty.adjustFilters
                          : MESSAGES.empty.createFirst}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {filteredResponsables.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={filteredResponsables.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              ¿Está seguro de eliminar este responsable?
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El responsable "
              {responsableToDelete?.nombre1?.trim()} {responsableToDelete?.paterno?.trim()}"
              será eliminado permanentemente.
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

export default ResponsableList;
