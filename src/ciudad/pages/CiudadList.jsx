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

import CiudadFilters from "../components/CiudadFilters";
import CiudadTable from "../components/CiudadTable";
import { useToast } from "@/hooks/use-toast";
import { useCrudModal } from "@/hooks/useCrudModal";
import { useCatalogState } from "@/hooks/useCatalogState";

import {
  fetchCiudades,
  addCiudad,
  updateCiudad,
  deleteCiudad,
} from "@/store/ciudad/ciudadThunks";
import {
  selectCiudades,
  selectCiudadesLoading,
  selectCiudadesError,
} from "@/store/ciudad/ciudadSlice";
import CiudadForm from "./CiudadForm";

const INITIAL_FILTERS = { search: "" };

const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const CiudadList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const ciudads = useSelector(selectCiudades);
  const isLoading = useSelector(selectCiudadesLoading);
  const error = useSelector(selectCiudadesError);

  const {
    isFormOpen,
    setIsFormOpen,
    editingItem: editingCiudad,
    handleAdd,
    handleEdit,
    handleCancelForm: handleCancel,
    itemToDelete: ciudadToDelete,
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
    data: ciudads,
    searchFields: ["descripcion","codigociudad"],
    sortField: "descripcion"
  });

  useEffect(() => {
    dispatch(fetchCiudades());
  }, [dispatch]);

  const confirmDelete = useCallback(() => {
    if (ciudadToDelete) {
      dispatch(deleteCiudad(ciudadToDelete.codigociudad));
      setIsDeleteDialogOpen(false);
      toast({ title: "¡Éxito!", description: "Se ha eliminado correctamente." });
    }
  }, [ciudadToDelete, dispatch, toast, setIsDeleteDialogOpen]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingCiudad
      ? updateCiudad({ codigociudad: editingCiudad.codigociudad, updatedCiudad: data })
      : addCiudad(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `Se ha ${editingCiudad ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingCiudad, toast, handleCancel]);

  if (isLoading && ciudads.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ciudades</h1>
          <p className="text-muted-foreground">Administra las ciudades del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingCiudad ? "Editar Ciudad" : "Nueva Ciudad"}</DialogTitle>
              <DialogDescription>{editingCiudad ? "Modifica los datos de la ciudad" : "Ingresa la información de la nueva ciudad"}</DialogDescription>
            </DialogHeader>
            <CiudadForm ciudadToEdit={editingCiudad} onSubmit={handleSubmit} onCancel={handleCancel} />
          </DialogContent>
        </Dialog>
      </div>

      <CiudadFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Lista de Ciudades</CardTitle>
        </CardHeader>
        <CardContent>
          <CiudadTable
            ciudades={paginatedData}
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
            <DialogTitle>¿Está seguro de eliminar esta ciudad?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. La ciudad "{ciudadToDelete?.descripcion}" será eliminada permanentemente.</DialogDescription>
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

export default CiudadList;
