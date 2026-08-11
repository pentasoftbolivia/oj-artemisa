import { useState, useCallback } from "react";

const INITIAL_FILTERS = { search: "", rubro: "", carnet: "", ciudad: "", ambiente: "", inmueble: "", nivel: "" };

export function useActivosFijosState() {
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const handlePageChange = useCallback((page) => setCurrentPage(page), []);
  const handlePageSizeChange = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((type, value) => {
    setFilters((p) => {
      const next = { ...p, [type]: value };
      if (type === "ciudad") {
        next.inmueble = "";
        next.nivel = "";
        next.ambiente = "";
      } else if (type === "inmueble") {
        next.nivel = "";
        next.ambiente = "";
      } else if (type === "nivel") {
        next.ambiente = "";
      }
      return next;
    });
  }, []);

  const handleSearch = useCallback(() => {
    setAppliedFilters({ ...filters });
    setCurrentPage(1);
  }, [filters]);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setAppliedFilters({ ...INITIAL_FILTERS });
    setCurrentPage(1);
  }, []);

  return {
    filters,
    appliedFilters,
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    handleFilterChange,
    handleSearch,
    clearFilters
  };
}
