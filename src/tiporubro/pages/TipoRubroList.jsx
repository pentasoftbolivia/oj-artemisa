import React, { useState, useEffect, useCallback, useMemo } from "react";
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

import TipoRubroFilters from "../components/TipoRubroFilters";
import TipoRubroTable from "../components/TipoRubroTable";
import { useToast } from "@/hooks/use-toast";
import { useCrudModal } from "@/hooks/useCrudModal";
import { useCatalogState } from "@/hooks/useCatalogState";

import {
  fetchTipoRubros,
  addTipoRubro,
  updateTipoRubro,
  deleteTipoRubro,
} from "@/store/tiporubro/tiporubroThunks";
import {
  selectTipoRubros,
  selectTipoRubrosLoading,
  selectTipoRubrosError,
} from "@/store/tiporubro/tiporubroSlice";
import { fetchRubros } from "@/store/rubro/rubroThunks";
import { selectRubros } from "@/store/rubro/rubroSlice";
import TipoRubroForm from "./TipoRubroForm";

const INITIAL_FILTERS = { search: "" };
const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const TipoRubroList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const tiporubros = useSelector(selectTipoRubros);
  const rubros = useSelector(selectRubros);
  const isLoading = useSelector(selectTipoRubrosLoading);
  const error = useSelector(selectTipoRubrosError);

  const {
    isFormOpen,
    setIsFormOpen,
    editingItem: editingTipoRubro,
    handleAdd,
    handleEdit,
    handleCancelForm: handleCancel,
    itemToDelete: tiporubroToDelete,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    handleDelete,
  } = useCrudModal();

  const {
    filters,
    currentPage,
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
    data: tiporubros,
    searchFields: ["descripciontiporubroact","tiporubroact","codigorubroact"],
    sortField: "descripciontiporubroact"
  });

  useEffect(() => {
    dispatch(fetchTipoRubros());
    dispatch(fetchRubros());
  }, [dispatch]);

  const rubrosMap = useMemo(() => {
    return rubros.reduce((acc, r) => {
      acc[r.codigorubroact] = r.descripcionrubroact;
      return acc;
    }, {});
  }, [rubros]);

  const confirmDelete = useCallback(() => {
    if (tiporubroToDelete) {
      dispatch(deleteTipoRubro(tiporubroToDelete.tiporubroact));
      setIsDeleteDialogOpen(false);
      toast({ title: "¡Éxito!", description: "Se ha eliminado correctamente." });
    }
  }, [tiporubroToDelete, dispatch, toast, setIsDeleteDialogOpen]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingTipoRubro
      ? updateTipoRubro({ tiporubroact: editingTipoRubro.tiporubroact, updatedTipoRubro: data })
      : addTipoRubro(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `Se ha ${editingTipoRubro ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingTipoRubro, toast, handleCancel]);

  if (isLoading && tiporubros.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tipos de Rubro</h1>
          <p className="text-muted-foreground">Administra los tipos de rubro del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingTipoRubro ? "Editar Tipo de Rubro" : "Nuevo Tipo de Rubro"}</DialogTitle>
              <DialogDescription>{editingTipoRubro ? "Modifica los datos del tipo de rubro" : "Ingresa la información del nuevo tipo de rubro"}</DialogDescription>
            </DialogHeader>
            <TipoRubroForm tiporubroToEdit={editingTipoRubro} onSubmit={handleSubmit} onCancel={handleCancel} />
          </DialogContent>
        </Dialog>
      </div>

      <TipoRubroFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Lista de Tipos de Rubro</CardTitle>
        </CardHeader>
        <CardContent>
          <TipoRubroTable
            tipoRubros={paginatedData}
            rubrosMap={rubrosMap}
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
            <DialogTitle>¿Está seguro de eliminar este tipo de rubro?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El tipo de rubro "{tiporubroToDelete?.descripciontiporubroact}" será eliminado permanentemente.</DialogDescription>
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

export default TipoRubroList;
