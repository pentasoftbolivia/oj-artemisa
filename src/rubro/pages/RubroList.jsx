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

import RubroFilters from "../components/RubroFilters";
import RubroTable from "../components/RubroTable";
import { useToast } from "@/hooks/use-toast";
import { useCrudModal } from "@/hooks/useCrudModal";
import { useCatalogState } from "@/hooks/useCatalogState";

import {
  fetchRubros,
  addRubro,
  updateRubro,
  deleteRubro,
} from "@/store/rubro/rubroThunks";
import {
  selectRubros,
  selectRubrosLoading,
  selectRubrosError,
} from "@/store/rubro/rubroSlice";
import RubroForm from "./RubroForm";

const INITIAL_FILTERS = { search: "" };

const RubroList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const rubros = useSelector(selectRubros);
  const isLoading = useSelector(selectRubrosLoading);
  const error = useSelector(selectRubrosError);

  const {
    isFormOpen,
    setIsFormOpen,
    editingItem: editingRubro,
    handleAdd,
    handleEdit,
    handleCancelForm: handleCancel,
    itemToDelete: rubroToDelete,
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
    data: rubros,
    searchFields: ["descripcionrubroact","codigorubroact"],
    sortField: "descripcionrubroact"
  });

  useEffect(() => {
    dispatch(fetchRubros());
  }, [dispatch]);

  const confirmDelete = useCallback(() => {
    if (rubroToDelete) {
      dispatch(deleteRubro(rubroToDelete.codigorubroact));
      setIsDeleteDialogOpen(false);
      toast({ title: "¡Éxito!", description: "Se ha eliminado correctamente." });
    }
  }, [rubroToDelete, dispatch, toast, setIsDeleteDialogOpen]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingRubro
      ? updateRubro({ codigorubroact: editingRubro.codigorubroact, updatedRubro: data })
      : addRubro(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `Se ha ${editingRubro ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingRubro, toast, handleCancel]);

  if (isLoading && rubros.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rubros</h1>
          <p className="text-muted-foreground">Administra los rubros del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingRubro ? "Editar Rubro" : "Nuevo Rubro"}</DialogTitle>
              <DialogDescription>{editingRubro ? "Modifica los datos del rubro" : "Ingresa la información del nuevo rubro"}</DialogDescription>
            </DialogHeader>
            <RubroForm rubroToEdit={editingRubro} onSubmit={handleSubmit} onCancel={handleCancel} />
          </DialogContent>
        </Dialog>
      </div>

      <RubroFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Lista de Rubros</CardTitle>
        </CardHeader>
        <CardContent>
          <RubroTable
            rubros={paginatedData}
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
            <DialogTitle>¿Está seguro de eliminar este rubro?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El rubro "{rubroToDelete?.descripcionrubroact}" será eliminado permanentemente.</DialogDescription>
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

export default RubroList;
