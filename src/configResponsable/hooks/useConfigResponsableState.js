import { useState, useCallback, useMemo } from "react";
import { useDispatch } from "react-redux";
import { fetchResponsable } from "@/store/responsable/responsableThunks";
import { useToast } from "@/hooks/use-toast";

const INITIAL_FILTERS = {
  carnet: "",
  nombre: "",
  paterno: "",
  cargo: "",
};

export const useConfigResponsableState = (responsables) => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const [draftFilters, setDraftFilters] = useState({ ...INITIAL_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...INITIAL_FILTERS });
  const [searched, setSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const handleFilterChange = useCallback((type, value) => {
    setDraftFilters(p => ({ ...p, [type]: value }));
  }, []);

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

  const clearFilters = useCallback(() => {
    setDraftFilters({ ...INITIAL_FILTERS });
    setAppliedFilters({ ...INITIAL_FILTERS });
    setSearched(false);
    setCurrentPage(1);
  }, []);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  return {
    draftFilters,
    appliedFilters,
    searched,
    currentPage,
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
  };
};
