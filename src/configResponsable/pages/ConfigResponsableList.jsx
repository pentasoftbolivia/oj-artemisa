import React, { useCallback, useState } from "react";
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
import { Plus, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
    searched,
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

  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateCarnet, setDuplicateCarnet] = useState("");

  const isDuplicateError = (msg) => {
    const s = String(msg || "").toLowerCase();
    return s.includes("duplicate") || s.includes("23505") || s.includes("unique") || s.includes("ya existe") || s.includes("already exists");
  };

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
    const isEditing = Boolean(editingResponsable);
    const newCi = String(data.cirun || "").trim();

    // Validación previa solo al CREAR (Nuevo) - cirun deshabilitado en edición
    if (!isEditing && newCi) {
      // 1) chequeo en memoria (redux)
      const existsInMemory = (responsables || []).some((r) => String(r.cirun || "").trim() === newCi);
      if (existsInMemory) {
        setDuplicateCarnet(newCi);
        setIsDuplicateModalOpen(true);
        return false;
      }
      // 2) chequeo en BD (por si lista no está cargada o desactualizada)
      try {
        const { data: found, error } = await supabase.from("act_responsable").select("cirun").eq("cirun", newCi).maybeSingle();
        if (!error && found) {
          setDuplicateCarnet(newCi);
          setIsDuplicateModalOpen(true);
          return false;
        }
      } catch (_) {
        // ignorar error de chequeo y dejar que el insert lo valide
      }
    }

    const action = isEditing
      ? updateResponsable({ cirun: editingResponsable.cirun, updatedResponsable: data })
      : addResponsable(data);
    try {
      await dispatch(action).unwrap();
      toast({ title: "¡Éxito!", description: `El responsable se ha ${isEditing ? "actualizado" : "guardado"} correctamente.` });
      handleCancel();
      return true;
    } catch (err) {
      const msg = err?.message || err || "";
      if (!isEditing && isDuplicateError(msg)) {
        setDuplicateCarnet(newCi || String(err?.cirun || ""));
        setIsDuplicateModalOpen(true);
        return false;
      }
      toast({ title: "Error", description: `Fallo al guardar: ${msg || "Error desconocido"}`, variant: "destructive" });
      return false;
    }
  }, [dispatch, editingResponsable, toast, handleCancel, responsables]);

  if (isLoading && responsables.length === 0) return <LoadingSpinner />;
  if (error) return <div className="bg-red-600 text-white text-center p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">Responsables (Configuración)</h1>
          <p className="text-sm text-muted-foreground leading-tight">Administra los registros completos de responsables en el sistema</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd} className="w-full sm:w-auto min-h-11 sm:min-h-9">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
          </DialogTrigger>
          <DialogContent
            className="w-[96vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            onInteractOutside={(e) => {
              e.preventDefault();
              handleCancel();
            }}
          >
            <DialogHeader className="pr-6">
              <DialogTitle className="text-base sm:text-lg leading-tight">
                {editingResponsable ? "Editar Responsable" : "Nuevo Responsable"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm leading-tight">
                {editingResponsable ? "Modifica los datos del responsable" : "Ingresa la información del nuevo responsable"}
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
        <Card className="overflow-hidden">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base leading-tight">
              <Users className="h-4 w-4 shrink-0" />
              <span>Resultados de Búsqueda</span>
              <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-auto">
                {filtered.length} registro(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No se encontraron responsables que coincidan con la búsqueda.
              </div>
            ) : (
              <>
                <ConfigResponsableTable responsables={paginatedData} onEdit={handleEdit} onDelete={handleDelete} />
                <div className="mt-4">
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
                </div>
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
        <DialogContent className="w-[96vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader className="pr-6 space-y-1">
            <DialogTitle className="text-base sm:text-lg leading-tight">¿Está seguro de eliminar este responsable?</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm leading-tight break-words">
              Esta acción no se puede deshacer. El responsable &quot;{responsableToDelete?.nombre1} {responsableToDelete?.paterno}&quot; será eliminado permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="w-full sm:w-auto min-h-11 sm:min-h-9 order-2 sm:order-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} className="w-full sm:w-auto min-h-11 sm:min-h-9 order-1 sm:order-2">
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal grande centrado: Carnet duplicado */}
      <Dialog open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
        <DialogContent className="w-[96vw] sm:max-w-[520px] p-0 overflow-hidden border-0 bg-transparent shadow-none gap-0 [&>button]:hidden" aria-describedby={undefined}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border-2 border-red-500 overflow-hidden animate-in zoom-in-95">
            <div className="bg-red-600 px-4 sm:px-8 py-6 sm:py-8 text-center">
              <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center mb-3 sm:mb-4 shadow-md">
                <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8 text-red-600" />
              </div>
              <h2 className="text-white text-xl sm:text-2xl font-black tracking-tight uppercase leading-tight">¡Atención!</h2>
            </div>
            <div className="px-4 sm:px-8 py-6 sm:py-8 text-center space-y-3 sm:space-y-4">
              <p className="text-lg sm:text-2xl font-extrabold text-red-600 dark:text-red-400 leading-tight">El Número de Carnet ya se encuentra Registrado!!!</p>
              {duplicateCarnet && (
                <p className="text-sm sm:text-base text-muted-foreground">
                  Carnet: <span className="font-mono font-bold text-foreground text-base sm:text-lg break-all">{duplicateCarnet}</span>
                </p>
              )}
              <p className="text-xs sm:text-sm text-muted-foreground leading-tight">Verifique el número e intente con otro carnet o busque el registro existente.</p>
              <Button onClick={() => setIsDuplicateModalOpen(false)} className="w-full sm:w-auto min-w-[160px] min-h-11 sm:min-h-10 mt-2 bg-red-600 hover:bg-red-700 text-white font-semibold">
                Entendido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConfigResponsableList;