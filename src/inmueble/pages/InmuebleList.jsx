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

import InmuebleFilters from "../components/InmuebleFilters";
import InmuebleTable from "../components/InmuebleTable";
import { useToast } from "@/hooks/use-toast";
import { useCrudModal } from "@/hooks/useCrudModal";
import { useCatalogState } from "@/hooks/useCatalogState";

import {
  fetchInmuebles,
  addInmueble,
  updateInmueble,
  deleteInmueble,
} from "@/store/inmueble/inmuebleThunks";
import {
  selectInmuebles,
  selectInmueblesLoading,
  selectInmueblesError,
} from "@/store/inmueble/inmuebleSlice";
import InmuebleForm from "./InmuebleForm";

const INITIAL_FILTERS = { search: "" };
const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const InmuebleList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const inmuebles = useSelector(selectInmuebles);
  const isLoading = useSelector(selectInmueblesLoading);
  const error = useSelector(selectInmueblesError);

  const {
    isFormOpen,
    setIsFormOpen,
    editingItem: editingInmueble,
    handleAdd,
    handleEdit,
    handleCancelForm: handleCancel,
    itemToDelete: inmuebleToDelete,
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
    data: inmuebles,
    searchFields: ["descripcion","codigoinmueble"],
    sortField: "descripcion"
  });

  useEffect(() => {
    dispatch(fetchInmuebles());
  }, [dispatch]);

  const confirmDelete = useCallback(() => {
    if (inmuebleToDelete) {
      dispatch(deleteInmueble(inmuebleToDelete.codigoinmueble));
      setIsDeleteDialogOpen(false);
      toast({ title: "¡Éxito!", description: "Se ha eliminado correctamente." });
    }
  }, [inmuebleToDelete, dispatch, toast, setIsDeleteDialogOpen]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingInmueble
      ? updateInmueble({ codigoinmueble: editingInmueble.codigoinmueble, updatedInmueble: data })
      : addInmueble(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `Se ha ${editingInmueble ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingInmueble, toast, handleCancel]);

  if (isLoading && inmuebles.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inmuebles</h1>
          <p className="text-muted-foreground">Administra los inmuebles del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingInmueble ? "Editar Inmueble" : "Nuevo Inmueble"}</DialogTitle>
              <DialogDescription>{editingInmueble ? "Modifica los datos del inmueble" : "Ingresa la información del nuevo inmueble"}</DialogDescription>
            </DialogHeader>
            <InmuebleForm inmuebleToEdit={editingInmueble} onSubmit={handleSubmit} onCancel={handleCancel} />
          </DialogContent>
        </Dialog>
      </div>

      <InmuebleFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Lista de Inmuebles</CardTitle>
        </CardHeader>
        <CardContent>
          <InmuebleTable
            inmuebles={paginatedData}
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
            <DialogTitle>¿Está seguro de eliminar este inmueble?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El inmueble "{inmuebleToDelete?.inmueble}" será eliminado permanentemente.</DialogDescription>
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

export default InmuebleList;
