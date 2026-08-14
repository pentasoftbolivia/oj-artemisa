import React, { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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

import ConfigResponsableFilters from "../components/ConfigResponsableFilters";
import ConfigResponsableTable from "../components/ConfigResponsableTable";
import { useToast } from "@/hooks/use-toast";
import {
  addResponsable,
  updateResponsable,
  deleteResponsable,
} from "@/store/responsable/responsableThunks";
import {
  selectResponsable,
  selectResponsableLoading,
  selectResponsableError,
} from "@/store/responsable/responsableSlice";
import ConfigResponsableForm from "./ConfigResponsableForm";

import { useConfigResponsableState } from "../hooks/useConfigResponsableState";
import { useCrudModal } from "@/hooks/useCrudModal";

const ConfigResponsableList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const responsables = useSelector(selectResponsable);
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
    searched,
    currentPage,
    pageSize,
    setPageSize,
    setCurrentPage,
    handleFilterChange,
    handleSearch,
    clearFilters,
    filteredResponsables: filtered,
    paginatedData,
    totalPages,
    safeCurrentPage
  } = useConfigResponsableState(responsables);

  const confirmDelete = useCallback(async () => {
    if (!responsableToDelete) return;
    try {
      await dispatch(deleteResponsable(responsableToDelete.cirun)).unwrap();
      setIsDeleteDialogOpen(false);
      toast({ title: "¡Éxito!", description: "El responsable se ha eliminado correctamente." });
    } catch (err) {
      console.error("Error deleting responsable:", err);
      toast({ title: "Error", description: `Fallo al eliminar: ${err.message || "Error desconocido"}`, variant: "destructive" });
    }
  }, [responsableToDelete, dispatch, toast, setIsDeleteDialogOpen]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingResponsable
      ? updateResponsable({ cirun: editingResponsable.cirun, updatedResponsable: data })
      : addResponsable(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `El responsable se ha ${editingResponsable ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingResponsable, toast, handleCancel]);

  if (isLoading && responsables.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Responsables (Configuración)</h1>
          <p className="text-muted-foreground">
            Administra los registros completos de responsables en el sistema
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
            className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => {
              e.preventDefault();
              handleCancel();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingResponsable ? "Editar Responsable" : "Nuevo Responsable"}
              </DialogTitle>
              <DialogDescription>
                {editingResponsable
                  ? "Modifica los datos del responsable"
                  : "Ingresa la información del nuevo responsable"}
              </DialogDescription>
            </DialogHeader>
            <ConfigResponsableForm
              responsableToEdit={editingResponsable}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ConfigResponsableFilters
        filters={draftFilters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClearFilters={clearFilters}
      />

      {searched ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Resultados de Búsqueda
              <span className="text-sm font-normal text-muted-foreground ml-auto">
                {filtered.length} registro(s) encontrados
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron responsables que coincidan con la búsqueda.
              </div>
            ) : (
              <>
                <ConfigResponsableTable
                  responsables={paginatedData}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
                <DataPagination
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  totalCount={filtered.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium text-foreground">
              Búsqueda de Responsables
            </p>
            <p className="max-w-sm mt-1">
              Ingresa los criterios de búsqueda en el panel superior y presiona
              Buscar para ver los resultados.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Está seguro de eliminar este responsable?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El responsable "
              {responsableToDelete?.nombre1} {responsableToDelete?.paterno}"
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

export default ConfigResponsableList;