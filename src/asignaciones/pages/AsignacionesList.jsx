import { useCallback } from "react";
import { useSelector } from "react-redux";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/loading-spinner";
import DataPagination from "@/components/ui/data-pagination";
import { ClipboardList } from "lucide-react";

import AsignacionesFilters from "../components/AsignacionesFilters";
import AsignacionesTable from "../components/AsignacionesTable";

import {
  selectAsignacionesData,
  selectAsignacionesTotalCount,
  selectAsignacionesLoading,
  selectAsignacionesError,
} from "@/store/asignaciones/asignacionesSlice";
import { useAsignacionesState } from "../hooks/useAsignacionesState";

const ESTADOS = ["Activo", "Baja"];

const AsignacionesList = () => {
  const asignaciones = useSelector(selectAsignacionesData);
  const totalCount = useSelector(selectAsignacionesTotalCount);
  const isLoading = useSelector(selectAsignacionesLoading);
  const error = useSelector(selectAsignacionesError);

  const {
    rubros,
    filters,
    currentPage,
    pageSize,
    hasActiveFilters,
    setPageSize,
    setCurrentPage,
    handleFilterChange,
    clearFilters,
  } = useAsignacionesState();

  const getNombreCompleto = useCallback((a) => {
    const partes = [a.nombre1, a.nombre2, a.paterno, a.materno].filter(Boolean);
    return partes.join(" ") || "—";
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const showPagination = totalCount > 0;

  if (isLoading && asignaciones.length === 0) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-600 text-white text-center p-6 rounded-lg">
        <p className="text-lg font-medium">Error al cargar asignaciones</p>
        <p className="text-sm mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Asignaciones</h1>
        <p className="text-muted-foreground">
          Visualiza las asignaciones de activos a funcionarios (Usa los filtros
          para buscar información)
        </p>
      </div>

      <AsignacionesFilters
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        rubros={rubros}
        estados={ESTADOS}
        onFilterChange={handleFilterChange}
        onClearFilters={clearFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Lista de Asignaciones
            {totalCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-auto">
                {totalCount} registro(s)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AsignacionesTable
            asignaciones={asignaciones}
            hasActiveFilters={hasActiveFilters}
          />

          {showPagination && (
            <DataPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AsignacionesList;
