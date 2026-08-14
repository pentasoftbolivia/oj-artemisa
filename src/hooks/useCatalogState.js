import { useState, useMemo, useCallback } from "react";

const INITIAL_FILTERS = { search: "" };

export const useCatalogState = ({ data = [], searchFields = [], sortField = "" }) => {
  const [filters, setFilters] = useState({ ...INITIAL_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const handleFilterChange = useCallback((type, value) => {
    setFilters(p => ({ ...p, [type]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
    setCurrentPage(1);
  }, []);

  const filtered = useMemo(() =>
    data.filter(item => {
      if (!filters.search) return true;
      const searchLower = filters.search.toLowerCase();
      const matchString = searchFields.map(field => item[field] || "").join(" ").toLowerCase();
      return matchString.includes(searchLower);
    }).sort((a, b) => {
      if (!sortField) return 0;
      return String(a[sortField] || "").localeCompare(String(b[sortField] || ""));
    }), [data, filters, searchFields, sortField]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  return {
    filters,
    currentPage,
    pageSize,
    setPageSize,
    setCurrentPage,
    handleFilterChange,
    clearFilters,
    filteredData: filtered,
    paginatedData,
    totalPages,
    safeCurrentPage,
  };
};
