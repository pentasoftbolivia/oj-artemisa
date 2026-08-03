import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/loading-spinner";
import DataPagination from "@/components/ui/data-pagination";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";

import AsignacionesFilters from "../components/AsignacionesFilters";
import AsignacionesTable from "../components/AsignacionesTable";

import { fetchAsignaciones } from "@/store/asignaciones/asignacionesThunks";
import {
  resetAsignaciones,
  selectAsignacionesData,
  selectAsignacionesTotalCount,
  selectAsignacionesLoading,
  selectAsignacionesError,
} from "@/store/asignaciones/asignacionesSlice";

const ESTADOS = ["Activo", "Baja"];

const INITIAL_FILTERS = {
  searchFuncionario: "",
  searchActivo: "",
  searchGrupo: "",
  estado: "",
};

const EMPTY_ARRAY = [];

const AsignacionesList = () => {
  const dispatch = useDispatch();

  const asignaciones = useSelector(selectAsignacionesData);
  const totalCount = useSelector(selectAsignacionesTotalCount);
  const isLoading = useSelector(selectAsignacionesLoading);
  const error = useSelector(selectAsignacionesError);

  const [rubros, setRubros] = useState(EMPTY_ARRAY);
  useEffect(() => {
    supabase
      .from("act_rubro")
      .select("descripcionrubroact")
      .order("descripcionrubroact", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setRubros(data);
      });
  }, []);

  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const hasActiveFilters =
    filters.searchFuncionario ||
    filters.searchActivo ||
    filters.searchGrupo ||
    filters.estado;

  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (!hasActiveFilters) {
        dispatch(resetAsignaciones());
        return;
      }
      dispatch(fetchAsignaciones({ page: currentPage, pageSize, filters }));
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dispatch, hasActiveFilters, currentPage, pageSize, filters]);

  const handleFilterChange = useCallback((filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value === "__todos__" ? "" : value,
    }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setCurrentPage(1);
  }, []);

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
