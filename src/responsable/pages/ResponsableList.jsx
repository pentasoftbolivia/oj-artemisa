import React, { useCallback } from "react";
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
  addResponsable,
  updateResponsable,
  deleteResponsable,
} from "@/store/responsable/responsableThunks";
import {
  selectSortedResponsable,
  selectResponsableLoading,
  selectResponsableError,
} from "@/store/responsable/responsableSlice";
import { useResponsableUbicacion } from "../hooks/useResponsableUbicacion";
import ResponsableForm from "./ResponsableForm";
import { useCrudModal } from "@/hooks/useCrudModal";
import { useResponsableState } from "../hooks/useResponsableState";

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
    noSearch: "Realice una búsqueda para ver resultados",
    startSearch: "Use los filtros de la sección para buscar responsables",
    filtered: "No se encontraron responsables que coincidan con los filtros",
    adjustFilters: "Intenta ajustar los filtros de búsqueda",
  },
  placeholders: {
    search: "Buscar por nombre, apellido o cargo...",
    carnet: "Buscar por CI...",
  },
};

const ResponsableList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const responsables = useSelector(selectSortedResponsable);
  const isLoading = useSelector(selectResponsableLoading);
  const error = useSelector(selectResponsableError);

  const {
    isFormOpen,
    setIsFormOpen,
    editingItem: editingResponsable,
    handleAdd,
    handleEdit,
    handleCancelForm: handleCancel,
    itemToDelete: responsableToDelete,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    handleDelete,
  } = useCrudModal();

  const {
    draftFilters,
    appliedFilters,
    appliedAmbienteCodes,
    isLocationSearching,
    pageSize,
    setPageSize,
    setCurrentPage,
    handleFilterChange,
    handleSearch,
    clearFilters,
    filteredResponsables,
    paginatedData: paginatedResponsables,
    totalPages,
    safeCurrentPage,
    hasSearchFilters: hasActiveFilters
  } = useResponsableState(responsables);

  const {
    ciudadOptions,
    inmuebleOptionsByCiudad,
    nivelOptionsByInmueble,
    ambienteOptionsByNivel,
    isLoading: isLoadingCatalogos,
  } = useResponsableUbicacion(draftFilters);

  const confirmDelete = useCallback(async () => {
    if (!responsableToDelete) return;
    try {
      await dispatch(deleteResponsable(responsableToDelete.cirun)).unwrap();
      setIsDeleteDialogOpen(false);
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
  }, [responsableToDelete, dispatch, toast, setIsDeleteDialogOpen]);

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

  if (isLoading && hasActiveFilters && responsables.length === 0) {
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
        filters={draftFilters}
        hasActiveFilters={hasActiveFilters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClearFilters={clearFilters}
        messages={MESSAGES}
        ciudadOptions={ciudadOptions}
        inmuebleOptionsByCiudad={inmuebleOptionsByCiudad}
        nivelOptionsByInmueble={nivelOptionsByInmueble}
        ambienteOptionsByNivel={ambienteOptionsByNivel}
        isSearching={isLocationSearching}
        isLoadingCatalogos={isLoadingCatalogos}
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
            responsables={hasActiveFilters ? paginatedResponsables : []}
            hasActiveFilters={hasActiveFilters}
            onEdit={handleEdit}
            onDelete={handleDelete}
            messages={MESSAGES}
            locationFilters={{
              ciudad: appliedFilters.ciudad,
              inmueble: appliedFilters.inmueble,
              nivel: appliedFilters.nivel,
              ambiente: appliedFilters.ambiente,
            }}
            ambienteCodes={appliedAmbienteCodes}
          />

          {hasActiveFilters && filteredResponsables.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={filteredResponsables.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
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