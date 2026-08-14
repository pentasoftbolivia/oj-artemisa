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

import NivelFilters from "../components/NivelFilters";
import NivelTable from "../components/NivelTable";
import { useToast } from "@/hooks/use-toast";
import { useCrudModal } from "@/hooks/useCrudModal";
import { useCatalogState } from "@/hooks/useCatalogState";

import {
  fetchNiveles,
  addNivel,
  updateNivel,
  deleteNivel,
} from "@/store/nivel/nivelThunks";
import {
  selectNiveles,
  selectNivelesLoading,
  selectNivelesError,
} from "@/store/nivel/nivelSlice";
import NivelForm from "./NivelForm";

const INITIAL_FILTERS = { search: "" };
const ESTADO_MAP = { 1: "Activo", 0: "Inactivo" };

const NivelList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const nivels = useSelector(selectNiveles);
  const isLoading = useSelector(selectNivelesLoading);
  const error = useSelector(selectNivelesError);

  const {
    isFormOpen,
    setIsFormOpen,
    editingItem: editingNivel,
    handleAdd,
    handleEdit,
    handleCancelForm: handleCancel,
    itemToDelete: nivelToDelete,
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
    data: nivels,
    searchFields: ["descripcion","codigonivel"],
    sortField: "descripcion"
  });

  useEffect(() => {
    dispatch(fetchNiveles());
  }, [dispatch]);

  const confirmDelete = useCallback(() => {
    if (nivelToDelete) {
      dispatch(deleteNivel(nivelToDelete.codigonivel));
      setIsDeleteDialogOpen(false);
      toast({ title: "¡Éxito!", description: "Se ha eliminado correctamente." });
    }
  }, [nivelToDelete, dispatch, toast, setIsDeleteDialogOpen]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingNivel
      ? updateNivel({ codigonivel: editingNivel.codigonivel, updatedNivel: data })
      : addNivel(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `Se ha ${editingNivel ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      toast({ title: "Error", description: `Fallo al guardar: ${err.message || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingNivel, toast, handleCancel]);

  if (isLoading && nivels.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Niveles</h1>
          <p className="text-muted-foreground">Administra los niveles del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingNivel ? "Editar Nivel" : "Nuevo Nivel"}</DialogTitle>
              <DialogDescription>{editingNivel ? "Modifica los datos del nivel" : "Ingresa la información del nuevo nivel"}</DialogDescription>
            </DialogHeader>
            <NivelForm nivelToEdit={editingNivel} onSubmit={handleSubmit} onCancel={handleCancel} />
          </DialogContent>
        </Dialog>
      </div>

      <NivelFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Lista de Niveles</CardTitle>
        </CardHeader>
        <CardContent>
          <NivelTable
            niveles={paginatedData}
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
            <DialogTitle>¿Está seguro de eliminar este nivel?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El nivel "{nivelToDelete?.nivel}" será eliminado permanentemente.</DialogDescription>
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

export default NivelList;
