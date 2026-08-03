import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Button } from "@/components/ui/button";
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
import LoadingSpinner from "@/components/ui/loading-spinner";
import DataPagination from "@/components/ui/data-pagination";
import { Plus, Users } from "lucide-react";

import ResponsableFilters from "../components/ResponsableFilters";
import ResponsableTable from "../components/ResponsableTable";
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

      <ResponsableFilters
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        cargos={[...new Set(responsables.map(r => r.cargo?.trim()).filter(Boolean))].sort()}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
        messages={MESSAGES}
      />

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
          <ResponsableTable
            responsables={paginatedResponsables}
            hasActiveFilters={hasActiveFilters}
            onEdit={handleEdit}
            onDelete={handleDelete}
            messages={MESSAGES}
          />

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
