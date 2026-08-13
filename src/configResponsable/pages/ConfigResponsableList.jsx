import React, { useState, useCallback, useMemo } from "react";
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
  fetchResponsable,
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

const INITIAL_FILTERS = {
  carnet: "",
  nombre: "",
  paterno: "",
  cargo: "",
};

const ConfigResponsableList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const responsables = useSelector(selectResponsable);
  const isLoading = useSelector(selectResponsableLoading);
  const error = useSelector(selectResponsableError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResponsable, setEditingResponsable] = useState(null);
  const [responsableToDelete, setResponsableToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ ...INITIAL_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...INITIAL_FILTERS });
  const [searched, setSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const handleAdd = useCallback(() => { setEditingResponsable(null); setIsFormOpen(true); }, []);
  const handleEdit = useCallback((r) => { setEditingResponsable(r); setIsFormOpen(true); }, []);
  const handleDelete = useCallback((r) => { setResponsableToDelete(r); setIsDeleteDialogOpen(true); }, []);

  const confirmDelete = useCallback(async () => {
    if (!responsableToDelete) return;
    try {
      await dispatch(deleteResponsable(responsableToDelete.cirun)).unwrap();
      setIsDeleteDialogOpen(false);
      setResponsableToDelete(null);
      toast({ title: "¡Éxito!", description: "El responsable se ha eliminado correctamente." });
    } catch (err) {
      console.error("Error deleting responsable:", err);
      toast({ title: "Error", description: `Fallo al eliminar: ${err.message || "Error desconocido"}`, variant: "destructive" });
    }
  }, [responsableToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => { setIsFormOpen(false); setEditingResponsable(null); }, []);
  const handleFilterChange = useCallback((type, value) => { setDraftFilters(p => ({ ...p, [type]: value })); }, []);

  const handleSearch = useCallback(async () => {
    if (responsables.length === 0) {
      try {
        await dispatch(fetchResponsable()).unwrap();
      } catch (err) {
        toast({ title: "Error", description: `Error al cargar responsables: ${err.message || "Error desconocido"}`, variant: "destructive" });
        return;
      }
    }
    setAppliedFilters({ ...draftFilters });
    setSearched(true);
    setCurrentPage(1);
  }, [draftFilters, dispatch, toast, responsables.length]);

  const filtered = useMemo(() => {
    if (!searched) return [];
    const normalize = (s) => (s || "").toLowerCase().trim();
    const carnetQuery = normalize(appliedFilters.carnet).replace(/\D/g, "");

    return responsables
      .filter((r) => {
        if (carnetQuery) {
          const carnetNum = (r.cirun || "").replace(/\D/g, "");
          if (!carnetNum.includes(carnetQuery)) return false;
        }
        if (appliedFilters.nombre) {
          const fullName = `${r.nombre1 || ""} ${r.nombre2 || ""}`.toLowerCase();
          if (!fullName.includes(normalize(appliedFilters.nombre))) return false;
        }
        if (appliedFilters.paterno) {
          if (!normalize(r.paterno).includes(normalize(appliedFilters.paterno))) return false;
        }
        if (appliedFilters.cargo) {
          if (!normalize(r.cargo).includes(normalize(appliedFilters.cargo))) return false;
        }
        return true;
      })
      .sort((a, b) => (a.cirun || "").localeCompare(b.cirun || ""));
  }, [responsables, appliedFilters, searched]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);
  const safeCurrentPage = useMemo(() => Math.min(currentPage, totalPages), [currentPage, totalPages]);
  const paginatedData = useMemo(() => { const start = (safeCurrentPage - 1) * pageSize; return filtered.slice(start, start + pageSize); }, [filtered, safeCurrentPage, pageSize]);

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

  const clearFilters = useCallback(() => {
    setDraftFilters({ ...INITIAL_FILTERS });
    setAppliedFilters({ ...INITIAL_FILTERS });
    setSearched(false);
    setCurrentPage(1);
  }, []);

  if (isLoading && responsables.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Responsables</h1>
          <p className="text-muted-foreground">Administra los responsables del sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" />Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]" onInteractOutside={(e) => { e.preventDefault(); handleCancel(); }}>
            <DialogHeader>
              <DialogTitle>{editingResponsable ? "Editar Responsable" : "Nuevo Responsable"}</DialogTitle>
              <DialogDescription>{editingResponsable ? "Modifica los datos del responsable" : "Ingresa la información del nuevo responsable"}</DialogDescription>
            </DialogHeader>
            <ConfigResponsableForm responsableToEdit={editingResponsable} onSubmit={handleSubmit} onCancel={handleCancel} />
          </DialogContent>
        </Dialog>
      </div>

      <ConfigResponsableFilters
        filters={draftFilters}
        hasActiveFilters={searched}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Lista de Responsables</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigResponsableTable
            responsables={searched ? paginatedData : []}
            hasActiveFilters={searched}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          {searched && filtered.length > 0 && (
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
            <DialogTitle>¿Está seguro de eliminar este responsable?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer. El responsable "{responsableToDelete?.nombre1?.trim()} {responsableToDelete?.paterno?.trim()}" será eliminado permanentemente.</DialogDescription>
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

export default ConfigResponsableList;