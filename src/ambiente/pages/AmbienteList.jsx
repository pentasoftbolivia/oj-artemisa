import React, { useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Building2 } from "lucide-react";

import AmbienteFilters from "../components/AmbienteFilters";
import AmbienteTable from "../components/AmbienteTable";
import { useToast } from "@/hooks/use-toast";
import { useCrudModal } from "@/hooks/useCrudModal";
import { useCatalogState } from "@/hooks/useCatalogState";

import {
  fetchAmbientes,
  addAmbiente,
  updateAmbiente,
  deleteAmbiente,
} from "@/store/ambiente/ambienteThunks";
import {
  selectAmbientes,
  selectAmbientesLoading,
  selectAmbientesError,
} from "@/store/ambiente/ambienteSlice";
import AmbienteForm from "./AmbienteForm";

const INITIAL_FILTERS = { search: "" };

const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const AmbienteList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const ambientes = useSelector(selectAmbientes);
  const isLoading = useSelector(selectAmbientesLoading);
  const error = useSelector(selectAmbientesError);

  const {
    isFormOpen,
    setIsFormOpen,
    editingItem: editingAmbiente,
    handleAdd,
    handleEdit,
    handleCancelForm: handleCancel,
    itemToDelete: ambienteToDelete,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    handleDelete,
  } = useCrudModal();

  const {
    filters,
    pageSize,
    setPageSize,
    setCurrentPage,
    handleFilterChange,
    clearFilters,
    filteredData: filtered,
    paginatedData,
    totalPages,
    safeCurrentPage,
  } = useCatalogState({
    data: ambientes,
    searchFields: ["ambiente","codigoambiente","codigonivel"],
    sortField: "ambiente"
  });

  useEffect(() => {
    dispatch(fetchAmbientes());
  }, [dispatch]);

  const confirmDelete = useCallback(() => {
    if (ambienteToDelete) {
      dispatch(deleteAmbiente(ambienteToDelete.codigoambiente));
      setIsDeleteDialogOpen(false);
      toast({ title: "¡Éxito!", description: "Se ha eliminado correctamente." });
    }
  }, [ambienteToDelete, dispatch, toast, setIsDeleteDialogOpen]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingAmbiente
      ? updateAmbiente({ codigoambiente: editingAmbiente.codigoambiente, updatedAmbiente: data })
      : addAmbiente(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `Se ha ${editingAmbiente ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingAmbiente, toast, handleCancel]);

  if (isLoading && ambientes.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ambientes</h1>
          <p className="text-muted-foreground">Administra los ambientes del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingAmbiente ? "Editar Ambiente" : "Nuevo Ambiente"}</DialogTitle>
              <DialogDescription>{editingAmbiente ? "Modifica los datos del ambiente" : "Ingresa la información del nuevo ambiente"}</DialogDescription>
            </DialogHeader>
            <AmbienteForm ambienteToEdit={editingAmbiente} onSubmit={handleSubmit} onCancel={handleCancel} />
          </DialogContent>
        </Dialog>
      </div>

      <AmbienteFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Lista de Ambientes</CardTitle>
        </CardHeader>
        <CardContent>
          <AmbienteTable
            ambientes={paginatedData}
            hasActiveFilters={!!filters.search}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          {filtered.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={filtered.length}
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
            <DialogTitle>¿Está seguro de eliminar este ambiente?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El ambiente "{ambienteToDelete?.ambiente}" será eliminado permanentemente.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AmbienteList;
