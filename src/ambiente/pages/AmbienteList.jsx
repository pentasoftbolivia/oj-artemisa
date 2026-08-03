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

import AmbienteFilters from "../components/AmbienteFilters";
import AmbienteTable from "../components/AmbienteTable";
import { useToast } from "@/hooks/use-toast";

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

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAmbiente, setEditingAmbiente] = useState(null);
  const [ambienteToDelete, setAmbienteToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    dispatch(fetchAmbientes());
  }, [dispatch]);

  const handleAdd = useCallback(() => { setEditingAmbiente(null); setIsFormOpen(true); }, []);
  const handleEdit = useCallback((a) => { setEditingAmbiente(a); setIsFormOpen(true); }, []);
  const handleDelete = useCallback((a) => { setAmbienteToDelete(a); setIsDeleteDialogOpen(true); }, []);

  const confirmDelete = useCallback(() => {
    if (ambienteToDelete) {
      dispatch(deleteAmbiente(ambienteToDelete.codigoambiente));
      setIsDeleteDialogOpen(false);
      setAmbienteToDelete(null);
      toast({ title: "¡Éxito!", description: "El ambiente se ha eliminado correctamente." });
    }
  }, [ambienteToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => { setIsFormOpen(false); setEditingAmbiente(null); }, []);
  const handleFilterChange = useCallback((type, value) => { setFilters(p => ({ ...p, [type]: value })); setCurrentPage(1); }, []);
  const clearFilters = useCallback(() => { setFilters({ ...INITIAL_FILTERS }); setCurrentPage(1); }, []);

  const filtered = useMemo(() =>
    ambientes.filter(a => {
      const s = `${a.ambiente || ""} ${a.codigoambiente || ""} ${a.codigonivel || ""}`.toLowerCase();
      return !filters.search || s.includes(filters.search.toLowerCase());
    }).sort((a, b) => (a.ambiente || "").localeCompare(b.ambiente || "")), [ambientes, filters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const safeCurrentPage = useMemo(() => Math.min(currentPage, totalPages), [currentPage, totalPages]);
  const paginatedData = useMemo(() => { const start = (safeCurrentPage - 1) * pageSize; return filtered.slice(start, start + pageSize); }, [filtered, safeCurrentPage, pageSize]);

  const handleSubmit = useCallback(async (data) => {
    const action = editingAmbiente
      ? updateAmbiente({ codigoambiente: editingAmbiente.codigoambiente, updatedAmbiente: data })
      : addAmbiente(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `El ambiente se ha ${editingAmbiente ? "actualizado" : "guardado"} correctamente.` });
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
