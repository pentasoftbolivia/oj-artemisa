import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch } from "react-redux";
import { supabase } from "@/lib/supabase";
import { fetchAsignaciones } from "@/store/asignaciones/asignacionesThunks";
import { resetAsignaciones } from "@/store/asignaciones/asignacionesSlice";

const INITIAL_FILTERS = {
  searchFuncionario: "",
  searchActivo: "",
  searchGrupo: "",
  estado: "",
};

export const useAsignacionesState = () => {
  const dispatch = useDispatch();

  const [rubros, setRubros] = useState([]);
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
    supabase
      .from("act_rubro")
      .select("descripcionrubroact")
      .order("descripcionrubroact", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setRubros(data);
      });
  }, []);

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

  return {
    rubros,
    filters,
    currentPage,
    pageSize,
    hasActiveFilters,
    setPageSize,
    setCurrentPage,
    handleFilterChange,
    clearFilters,
  };
};
