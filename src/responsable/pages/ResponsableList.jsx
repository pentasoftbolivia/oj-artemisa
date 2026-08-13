import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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

import ResponsableFilters from "../components/ResponsableFilters";
import ResponsableTable from "../components/ResponsableTable";
import { useToast } from "@/hooks/use-toast";
import {
  fetchResponsable,
  addResponsable,
  updateResponsable,
  deleteResponsable,
} from "@/store/responsable/responsableThunks";
import {
  selectSortedResponsable,
  selectResponsableLoading,
  selectResponsableError,
  resetResponsable,
} from "@/store/responsable/responsableSlice";
import { useResponsableUbicacion } from "../hooks/useResponsableUbicacion";
import { fetchMatchingCiruns, resolveAmbienteCodes } from "../services/responsableUbicacionService";
import ResponsableForm from "./ResponsableForm";

const INITIAL_FILTERS = {
  search: "",
  carnet: "",
  ciudad: "",
  inmueble: "",
  nivel: "",
  ambiente: "",
};

const MESSAGES = {
  success: {
    created: "El responsable ha sido guardado exitosamente.",
    updated: "El responsable se ha actualizado correctamente.",
    deleted: "El responsable se ha eliminado correctamente.",
  },
  error: {
    loading: "Error al cargar responsables",
    save: "Fallo al guardar el responsable",
    delete: "Error al eliminar el responsable",
    unknown: "Error desconocido",
  },
  empty: {
    noSearch: "Realice una búsqueda para ver resultados",
    startSearch: "Use los filtros de la sección para buscar responsables",
    filtered: "No se encontraron responsables que coincidan con los filtros",
    adjustFilters: "Intenta ajustar los filtros de búsqueda",
  },
  placeholders: {
    search: "Buscar por nombre, apellido o cargo...",
    carnet: "Buscar por CI...",
  },
};

const ESTADO_MAP = { 0: "Inactivo", 1: "Activo" };

const ResponsableList = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const responsables = useSelector(selectSortedResponsable);
  const isLoading = useSelector(selectResponsableLoading);
  const error = useSelector(selectResponsableError);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResponsable, setEditingResponsable] = useState(null);
  const [responsableToDelete, setResponsableToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ ...INITIAL_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...INITIAL_FILTERS });
  const [matchingCiruns, setMatchingCiruns] = useState(null);
  const [appliedAmbienteCodes, setAppliedAmbienteCodes] = useState(null);
  const [isLocationSearching, setIsLocationSearching] = useState(false);

  const {
    ciudadOptions,
    inmuebleOptionsByCiudad,
    nivelOptionsByInmueble,
    ambienteOptionsByNivel,
    isLoading: isLoadingCatalogos,
  } = useResponsableUbicacion(draftFilters);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const handleAdd = useCallback(() => {
    setEditingResponsable(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((responsable) => {
    setEditingResponsable(responsable);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((responsable) => {
    setResponsableToDelete(responsable);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!responsableToDelete) return;
    try {
      await dispatch(deleteResponsable(responsableToDelete.cirun)).unwrap();
      setIsDeleteDialogOpen(false);
      setResponsableToDelete(null);
      toast({
        title: "¡Éxito!",
        description: MESSAGES.success.deleted,
        variant: "default",
      });
    } catch (error) {
      console.error("Error deleting responsable:", error);
      toast({
        title: "Error",
        description: `${MESSAGES.error.delete}: ${error.message || MESSAGES.error.unknown}`,
        variant: "destructive",
      });
    }
  }, [responsableToDelete, dispatch, toast]);

  const handleCancel = useCallback(() => {
    setIsFormOpen(false);
    setEditingResponsable(null);
  }, []);

  const handleFilterChange = useCallback((filterType, value) => {
    setDraftFilters((prev) => {
      const next = { ...prev, [filterType]: value };
      if (filterType === "ciudad") {
        next.inmueble = "";
        next.nivel = "";
        next.ambiente = "";
      }
      if (filterType === "inmueble") {
        next.nivel = "";
        next.ambiente = "";
      }
      if (filterType === "nivel") {
        next.ambiente = "";
      }
      return next;
    });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!draftFilters.ambiente) {
      toast({
        title: "Seleccione un ambiente",
        description: "Debe seleccionar un ambiente para poder buscar.",
        variant: "destructive",
      });
      return;
    }

    if (responsables.length === 0) {
      setIsLocationSearching(true);
      try {
        await dispatch(fetchResponsable()).unwrap();
      } catch (error) {
        toast({
          title: "Error",
          description: `${MESSAGES.error.loading}: ${error.message || MESSAGES.error.unknown}`,
          variant: "destructive",
        });
        setIsLocationSearching(false);
        return;
      }
      setIsLocationSearching(false);
    }

    const { ciudad, inmueble, nivel, ambiente } = draftFilters;
    const hasLocation = Boolean(ciudad || inmueble || nivel || ambiente);

    let newMatching = null;
    let newAmbienteCodes = null;
    if (hasLocation) {
      setIsLocationSearching(true);
      try {
        newMatching = await fetchMatchingCiruns({ ciudad, inmueble, nivel, ambiente });
        newAmbienteCodes = await resolveAmbienteCodes({ ciudad, inmueble, nivel, ambiente });
      } catch (error) {
        const errMsg =
          error?.message || error?.details || error?.hint ||
          (error?.code ? `Código ${error.code}` : "") ||
          (() => { try { const s = JSON.stringify(error); return s && s !== "{}" ? s : String(error); } catch { return String(error); } })();
        console.error("Error buscando por ubicación:", error);
        toast({
          title: "Error",
          description: `No se pudo buscar por ubicación: ${errMsg}`,
          variant: "destructive",
        });
        newMatching = new Set();
        newAmbienteCodes = [];
      } finally {
        setIsLocationSearching(false);
      }
    }

    setMatchingCiruns(newMatching);
    setAppliedAmbienteCodes(newAmbienteCodes);
    setAppliedFilters({ ...draftFilters });
    setCurrentPage(1);
  }, [draftFilters, toast, dispatch, responsables.length]);

  const filteredResponsables = useMemo(
    () => {
      const hasLocation = Boolean(
        appliedFilters.ciudad ||
        appliedFilters.inmueble ||
        appliedFilters.nivel ||
        appliedFilters.ambiente,
      );
      return responsables.filter((r) => {
        const searchStr =
          `${r.cirun || ""} ${r.nombre1 || ""} ${r.nombre2 || ""} ${r.paterno || ""} ${r.materno || ""} ${r.cargo || ""}`.toLowerCase();
        const searchMatch =
          !appliedFilters.search || searchStr.includes(appliedFilters.search.toLowerCase());

        const carnetNum = (r.cirun || "").replace(/\D/g, "");
        const carnetQuery = (draftFilters.carnet || "").replace(/\D/g, "");
        const carnetMatch =
          !draftFilters.carnet || carnetNum.includes(carnetQuery);

        const locationMatch =
          !hasLocation || matchingCiruns?.has(String(r.cirun).trim());

        return searchMatch && carnetMatch && locationMatch;
      });
    },
    [responsables, draftFilters, appliedFilters, matchingCiruns],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredResponsables.length / pageSize)),
    [filteredResponsables.length, pageSize],
  );

  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const paginatedResponsables = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredResponsables.slice(start, start + pageSize);
  }, [filteredResponsables, safeCurrentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setDraftFilters({ ...INITIAL_FILTERS });
    setAppliedFilters({ ...INITIAL_FILTERS });
    setMatchingCiruns(null);
    setAppliedAmbienteCodes(null);
    setCurrentPage(1);
    dispatch(resetResponsable());
  }, [dispatch]);

  const hasActiveFilters = useMemo(
    () => Object.values(appliedFilters).some((value) => Boolean(value)),
    [appliedFilters],
  );

  const handleSubmit = useCallback(
    async (responsableData) => {
      const action = editingResponsable
        ? updateResponsable({
          cirun: editingResponsable.cirun,
          updatedResponsable: responsableData,
        })
        : addResponsable(responsableData);
      try {
        await dispatch(action).unwrap();
        toast({
          title: "¡Éxito!",
          description: editingResponsable
            ? MESSAGES.success.updated
            : MESSAGES.success.created,
          variant: "default",
        });
        handleCancel();
        return true;
      } catch (error) {
        console.error("Error saving responsable:", error);
        toast({
          title: "Error",
          description: `${MESSAGES.error.save}: ${error.message || MESSAGES.error.unknown}`,
          variant: "destructive",
        });
        return false;
      }
    },
    [dispatch, editingResponsable, toast, handleCancel],
  );

  if (isLoading && hasActiveFilters && responsables.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-red-600 text-white text-center p-6 rounded-lg">
        <p className="text-lg font-medium">{MESSAGES.error.loading}</p>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Responsables</h1>
          <p className="text-muted-foreground">
            Administra los responsables del sistema
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
            className="sm:max-w-[700px]"
            onInteractOutside={(e) => {
              e.preventDefault();
              handleCancel();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingResponsable
                  ? "Editar Responsable"
                  : "Nuevo Responsable"}
              </DialogTitle>
              <DialogDescription>
                {editingResponsable
                  ? "Modifica los datos del responsable"
                  : "Ingresa la información del nuevo responsable"}
              </DialogDescription>
            </DialogHeader>
            <ResponsableForm
              responsableToEdit={editingResponsable}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </DialogContent>
        </Dialog>
      </div>

      <ResponsableFilters
        filters={draftFilters}
        hasActiveFilters={hasActiveFilters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClearFilters={clearFilters}
        messages={MESSAGES}
        ciudadOptions={ciudadOptions}
        inmuebleOptionsByCiudad={inmuebleOptionsByCiudad}
        nivelOptionsByInmueble={nivelOptionsByInmueble}
        ambienteOptionsByNivel={ambienteOptionsByNivel}
        isSearching={isLocationSearching}
        isLoadingCatalogos={isLoadingCatalogos}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Responsables
          </CardTitle>
          <CardDescription>
            Todos los responsables registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsableTable
            responsables={hasActiveFilters ? paginatedResponsables : []}
            hasActiveFilters={hasActiveFilters}
            onEdit={handleEdit}
            onDelete={handleDelete}
            messages={MESSAGES}
            locationFilters={{
              ciudad: appliedFilters.ciudad,
              inmueble: appliedFilters.inmueble,
              nivel: appliedFilters.nivel,
              ambiente: appliedFilters.ambiente,
            }}
            ambienteCodes={appliedAmbienteCodes}
          />

          {hasActiveFilters && filteredResponsables.length > 0 && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={filteredResponsables.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              ¿Está seguro de eliminar este responsable?
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El responsable "
              {responsableToDelete?.nombre1?.trim()} {responsableToDelete?.paterno?.trim()}"
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

export default ResponsableList;
