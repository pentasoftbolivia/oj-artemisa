import { useState, useCallback, useRef, useEffect } from "react";
import { useDispatch } from "react-redux";

const INITIAL_FILTERS = { search: "", rubro: "", carnet: "", ciudad: "", ambiente: "", inmueble: "", nivel: "" };
const DEBOUNCE_MS = 300;

export function useActivosFijosState() {
  const dispatch = useDispatch();

  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCarnet, setDebouncedCarnet] = useState("");
  
  const isFirstRender = useRef(true);
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDebouncedSearch(filters.search);
      setDebouncedCarnet(filters.carnet);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setDebouncedCarnet(filters.carnet);
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [filters.search, filters.carnet]);

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

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setDebouncedSearch("");
    setDebouncedCarnet("");
    setCurrentPage(1);
    isFirstRender.current = true;
  }, []);

  return {
    filters,
    currentPage,
    pageSize,
    debouncedSearch,
    debouncedCarnet,
    handlePageChange,
    handlePageSizeChange,
    handleFilterChange,
    clearFilters
  };
}
