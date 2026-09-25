import { useState, useCallback, useMemo } from "react";
import { useDispatch } from "react-redux";
import { fetchResponsable } from "@/store/responsable/responsableThunks";
import { fetchMatchingCiruns, resolveAmbienteCodes } from "../services/responsableUbicacionService";
import { useToast } from "@/hooks/use-toast";
import { normalizeCi } from "@/inventario/constants/inventarioConstants";

const INITIAL_FILTERS = {
  search: "",
  carnet: "",
  numeroActa: "",
  ciudad: "",
  inmueble: "",
  nivel: "",
  ambiente: "",
};

export const useResponsableState = (responsables) => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const [draftFilters, setDraftFilters] = useState({ ...INITIAL_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...INITIAL_FILTERS });
  const [matchingCiruns, setMatchingCiruns] = useState(null);
  const [appliedAmbienteCodes, setAppliedAmbienteCodes] = useState(null);
  const [isLocationSearching, setIsLocationSearching] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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
    const hasNumeroActa = Boolean(String(draftFilters.numeroActa || "").trim());
    if (!draftFilters.ambiente && !hasNumeroActa) {
      toast({
        title: "Seleccione un ambiente",
        description: "Debe seleccionar un ambiente o ingresar un número de acta para poder buscar.",
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
          description: `Error al cargar responsables: ${error.message || "Error desconocido"}`,
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
        if (ambiente) {
          newAmbienteCodes = await resolveAmbienteCodes(ambiente);
        }
      } catch (error) {
        console.error("Error fetching location data:", error);
        toast({
          title: "Error",
          description: "No se pudo obtener la información de ubicación.",
          variant: "destructive",
        });
        setIsLocationSearching(false);
        return;
      }
      setIsLocationSearching(false);
    }

    setMatchingCiruns(newMatching);
    setAppliedAmbienteCodes(newAmbienteCodes);
    setAppliedFilters({ ...draftFilters });
    setCurrentPage(1);
  }, [draftFilters, responsables.length, dispatch, toast]);

  const clearFilters = useCallback(() => {
    setDraftFilters({ ...INITIAL_FILTERS });
    setAppliedFilters({ ...INITIAL_FILTERS });
    setMatchingCiruns(null);
    setAppliedAmbienteCodes(null);
    setCurrentPage(1);
  }, []);

  const hasSearchFilters = Object.values(appliedFilters).some((value) => Boolean(value));

  const filteredResponsables = useMemo(() => {
    if (!hasSearchFilters && !appliedFilters.ambiente) return [];

    const filtered = responsables.filter((resp) => {
      if (matchingCiruns !== null && !matchingCiruns.has(resp.cirun)) {
        return false;
      }

      if (appliedFilters.search) {
        const searchLower = appliedFilters.search.toLowerCase();
        const searchStr =
          `${resp.cirun || ""} ${resp.nombre1 || ""} ${resp.nombre2 || ""} ${resp.paterno || ""} ${resp.materno || ""} ${resp.cargo || ""}`.toLowerCase();
        if (!searchStr.includes(searchLower)) {
          return false;
        }
      }

      if (appliedFilters.carnet) {
        const queryNorm = normalizeCi ? normalizeCi(appliedFilters.carnet) : appliedFilters.carnet.toLowerCase().replace(/[^a-z0-9]/g, "");
        const ciNorm = normalizeCi ? normalizeCi(resp.cirun) : (resp.cirun || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!ciNorm.includes(queryNorm)) {
          return false;
        }
      }

      if (appliedFilters.numeroActa) {
        const query = String(appliedFilters.numeroActa).trim().toLowerCase();
        const numeroActaStr = String(resp.numeroacta ?? "").trim().toLowerCase();
        const actasStr = Array.isArray(resp.actas)
          ? resp.actas.map((a) => String(a.numeroacta ?? "").trim().toLowerCase()).join(" ")
          : "";
        const combined = `${numeroActaStr} ${actasStr}`.trim();
        if (!combined.includes(query)) {
          return false;
        }
      }

      return true;
    });

    // Orden ascendente por Número de Acta cuando se busca por acta
    if (appliedFilters.numeroActa) {
      const getNumeroActaValue = (r) => {
        const candidates = [];
        if (r.numeroacta != null && String(r.numeroacta).trim() !== "") {
          const n = Number(String(r.numeroacta).trim());
          if (!Number.isNaN(n)) candidates.push(n);
        }
        if (Array.isArray(r.actas)) {
          r.actas.forEach((a) => {
            const n = Number(String(a.numeroacta ?? "").trim());
            if (!Number.isNaN(n)) candidates.push(n);
          });
        }
        if (candidates.length === 0) return Infinity;
        return Math.min(...candidates);
      };
      filtered.sort((a, b) => {
        const va = getNumeroActaValue(a);
        const vb = getNumeroActaValue(b);
        if (va !== vb) return va - vb;
        // desempate por CI
        return String(a.cirun || "").localeCompare(String(b.cirun || ""));
      });
    }

    return filtered;
  }, [responsables, appliedFilters, matchingCiruns, hasSearchFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredResponsables.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredResponsables.slice(start, start + pageSize);
  }, [filteredResponsables, safeCurrentPage, pageSize]);

  return {
    draftFilters,
    appliedFilters,
    matchingCiruns,
    appliedAmbienteCodes,
    isLocationSearching,
    currentPage,
    pageSize,
    setPageSize,
    setCurrentPage,
    handleFilterChange,
    handleSearch,
    clearFilters,
    filteredResponsables,
    paginatedData,
    totalPages,
    safeCurrentPage,
    hasSearchFilters
  };
};
