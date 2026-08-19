import { useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toCamelCaseArray } from "@/lib/mapFields";
import { getCachedCatalog } from "@/lib/catalogCache";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";
import { resolveAmbienteCodes, countActivosByUbicacion } from "@/lib/ubicacionFilters";
import { useToast } from "@/hooks/use-toast";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "../constants/inventarioConstants";

const DEFAULT_PAGE_SIZE = 50;
const MIN_LOADING_MS = 400;

const aggregatePerUserRows = (userRows) => {
  const acc = {};
  userRows.forEach(r => {
    const email = r.usuarioinventario;
    if (!email) return;
    if (!acc[email]) acc[email] = { revisado: 0, pendiente: 0 };
    if (String(r.estadoinventario || "") === "REVISADO") {
      acc[email].revisado += 1;
    } else {
      acc[email].pendiente += 1;
    }
  });
  return Object.entries(acc).map(([email, counts]) => ({ email, ...counts }));
};

export const useInventarioData = () => {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [activos, setActivos] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [tipoRubros, setTipoRubros] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [niveles, setNiveles] = useState([]);

  const [directAmbMap, setDirectAmbMap] = useState({});
  const [directRespMap, setDirectRespMap] = useState({});
  const ambientesRef = useRef([]);
  const responsablesRef = useRef([]);
  const directAmbRef = useRef({});
  const directRespRef = useRef({});

  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalStats, setTotalStats] = useState({ total: 0, revisados: 0, noRevisados: 0 });
  const [inventariadorStats, setInventariadorStats] = useState([]);
  const [inmuebleCount, setInmuebleCount] = useState(0);
  const [summaryStats, setSummaryStats] = useState(null);
  const [summaryInmuebleCount, setSummaryInmuebleCount] = useState(0);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const pageRef = useRef(1);
  const pageSizeRef = useRef(DEFAULT_PAGE_SIZE);
  const filtersRef = useRef({});

  const rubroDescMap = useMemo(() => {
    const map = {};
    (rubros || []).forEach(r => {
      map[r.codigorubroact] = r.descripcionrubroact;
      map[String(r.codigorubroact)] = r.descripcionrubroact;
    });
    return map;
  }, [rubros]);

  const rubroFromTipo = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach(t => {
      map[t.tiporubroact] = rubroDescMap[t.codigorubroact];
      map[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
    });
    return map;
  }, [tipoRubros, rubroDescMap]);

  const tipoRubroDescMap = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach(t => {
      map[t.tiporubroact] = t.descripciontiporubroact;
      map[String(t.tiporubroact)] = t.descripciontiporubroact;
    });
    return map;
  }, [tipoRubros]);

  const ambienteMap = useMemo(() => {
    const map = {};
    (ambientes.length > 0 ? ambientes : ambientesRef.current).forEach(a => {
      const code = String(a.codigoambiente ?? "").trim();
      if (code) { map[code] = a.ambiente; }
    });
    return map;
  }, [ambientes]);

  const responsableMap = useMemo(() => {
    const map = {};
    (responsables.length > 0 ? responsables : responsablesRef.current).forEach(r => {
      const raw = String(r.cirun ?? "").trim();
      map[raw] = r;
      const norm = normalizeCi(r.cirun);
      if (norm !== raw) map[norm] = r;
      const loose = normalizeCiLoose(r.cirun);
      if (loose !== raw && loose !== norm) map[loose] = r;
      const prefix = getCiPrefix(raw);
      if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) map[prefix] = r;
    });
    return map;
  }, [responsables]);

  const loadCatalogos = useCallback(async () => {
    const safeGet = async (table) => {
      try {
        return await getCachedCatalog(table);
      } catch (err) {
        console.error(`Error loading ${table}:`, err);
        return [];
      }
    };

    const [rubros, tipoRubros, ambientes, responsables, ciudades, inmuebles, niveles] =
      await Promise.all([
        safeGet("act_rubro"),
        safeGet("act_tiporubro"),
        safeGet("act_ambiente"),
        safeGet("act_responsable"),
        safeGet("act_ciudad"),
        safeGet("act_inmueble"),
        safeGet("act_nivel"),
      ]);

    setRubros(rubros || []);
    setTipoRubros(tipoRubros || []);
    setAmbientes(ambientes || []);
    ambientesRef.current = ambientes || [];
    setResponsables(responsables || []);
    responsablesRef.current = responsables || [];
    setCiudades(ciudades || []);
    setInmuebles(inmuebles || []);
    setNiveles(niveles || []);
  }, []);

  const fetchData = useCallback(async (filters, p, ps) => {
    const {
      codigoActivo = "",
      inventariador = "",
      carnet = "",
      nombre = "",
      all = false,
      ciudad = "",
      inmueble = "",
      nivel = "",
      ambiente = "",
      estado = "all",
    } = filters;

    setIsLoading(true);
    const startedAt = Date.now();
    try {
      let ciFilter = [];

      if (nombre.trim()) {
        const words = nombre.trim().split(/\s+/).filter(Boolean);
        let respQuery = supabase.from("act_responsable").select("cirun");
        words.forEach(word => {
          respQuery = respQuery.or(`nombre1.ilike.%${word}%,nombre2.ilike.%${word}%,paterno.ilike.%${word}%,materno.ilike.%${word}%`);
        });

        const { data: matchingResp, error: respError } = await respQuery;

        if (respError) throw respError;

        if (!matchingResp || matchingResp.length === 0) {
          setActivos([]);
          setTotalCount(0);
          setTotalStats({ total: 0, revisados: 0, noRevisados: 0 });
          setInventariadorStats([]);
          setInmuebleCount(0);
          setDirectAmbMap({});
          directAmbRef.current = {};
          setDirectRespMap({});
          directRespRef.current = {};
          return;
        }
        ciFilter = matchingResp.map(r => normalizeCi(r.cirun));
      }

      let ambienteCodes = null;
      const inmuebleTotal = await countActivosByUbicacion({ ciudad, inmueble, nivel, ambiente });
      if (ambiente.trim()) {
        ambienteCodes = [ambiente.trim()];
      } else if (ciudad.trim() || inmueble.trim() || nivel.trim()) {
        ambienteCodes = await resolveAmbienteCodes({ ciudad, inmueble, nivel });
      }

      const applyFilters = (query, withEstado) => {
        let q = query.eq("ultimoregistro", 1);
        q = q.neq("estadoinventario", "EN PROCESO");
        if (!all && !carnet && !nombre) {
          q = q.gte("codigoactivointerno", 335774);
        }
        if (ambienteCodes != null) {
          q = q.in("codigoambiente", ambienteCodes.length > 0 ? ambienteCodes : [-1]);
        }
        if (codigoActivo.trim()) {
          const val = codigoActivo.trim().replace(/%/g, "");
          const numVal = Number(val);
          if (!isNaN(numVal)) {
            q = q.eq("codigoactivo", numVal);
          } else {
            q = q.eq("codigoactivo", -1);
          }
        }
        if (inventariador.trim()) {
          const val = inventariador.trim().replace(/%/g, "");
          q = q.ilike("usuarioinventario", `%${val}%`);
        }
        if (carnet.trim()) {
          const ci = carnet.trim().replace(/%/g, "");
          q = q.ilike("cirun", `%${ci}%`);
        }
        if (ciFilter.length > 0) {
          q = q.in("cirun", ciFilter);
        }
        if (withEstado && estado !== "all") {
          if (estado === "revisado") {
            q = q.eq("estadoinventario", "REVISADO");
          } else if (estado === "pendiente") {
            q = q.or("estadoinventario.is.null,estadoinventario.neq.REVISADO");
          }
        }
        return q;
      };

      const { count, error: countError } = await applyFilters(
        supabase.from("act_activos").select("codigoactivointerno", { count: "exact", head: true }),
        true,
      );
      if (countError) throw countError;

      const from = (p - 1) * ps;
      const to = from + ps - 1;
      const { data: batch, error: batchError } = await applyFilters(
        supabase.from("act_activos").select(ACTIVO_COLUMNS).order("codigoactivointerno", { ascending: false }),
        true,
      ).range(from, to);
      if (batchError) throw batchError;

      let revisados = 0;
      try {
        const { count: revisadosCount, error: estadoError } = await applyFilters(
          supabase.from("act_activos").select("codigoactivointerno", { count: "exact", head: true }),
          true,
        ).eq("estadoinventario", "REVISADO");
        if (!estadoError) {
          revisados = revisadosCount || 0;
        }
      } catch (e) {
        console.error("Error loading estado stats:", e);
      }

      let perUser = [];
      try {
        const CHUNK = 1000;
        let userRows = [];
        let start = 0;
        for (;;) {
          const { data, error } = await applyFilters(
            supabase.from("act_activos").select("usuarioinventario,estadoinventario"),
            false,
          ).range(start, start + CHUNK - 1);
          if (error) throw error;
          userRows = userRows.concat(data || []);
          if (!data || data.length < CHUNK) break;
          start += CHUNK;
        }
        perUser = aggregatePerUserRows(userRows);
      } catch (e) {
        console.error("Error loading per-user stats:", e);
      }

      const pageData = toCamelCaseArray(batch || []);
      setActivos(pageData);
      setTotalCount(count || 0);
      setInmuebleCount(inmuebleTotal);
      setTotalStats({ total: count || 0, revisados, noRevisados: (count || 0) - revisados });
      setInventariadorStats(perUser);

      const directAmb = {};
      const ambList = ambientes.length > 0 ? ambientes : ambientesRef.current;
      pageData.forEach(a => {
        const code = String(a.codigoambiente ?? "").trim();
        if (code) {
          const found = ambList.find(x => String(x.codigoambiente ?? "").trim() === code);
          if (found) directAmb[code] = found.ambiente;
        }
      });
      setDirectAmbMap(directAmb);
      directAmbRef.current = directAmb;

      const directResp = {};
      const respList = responsables.length > 0 ? responsables : responsablesRef.current;
      pageData.forEach(a => {
        const raw = String(a.cirun ?? "").trim();
        if (!raw) return;
        const resp = respList.find(r => {
          const rr = String(r.cirun ?? "").trim();
          return (
            rr === raw ||
            normalizeCi(rr) === raw ||
            normalizeCiLoose(rr) === raw ||
            getCiPrefix(rr) === raw
          );
        });
        if (resp) {
          const rr = String(resp.cirun ?? "").trim();
          directResp[rr] = resp;
          directResp[normalizeCi(rr)] = resp;
          directResp[normalizeCiLoose(rr)] = resp;
          const prefix = getCiPrefix(rr);
          if (prefix) directResp[prefix] = resp;
        }
      });
      setDirectRespMap(directResp);
      directRespRef.current = directResp;
    } catch (err) {
      toast({ title: "Error", description: `Error al cargar activos: ${err.message}`, variant: "destructive" });
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }
      setIsLoading(false);
    }
  }, [toast, ambientes, responsables]);

  const loadActivos = useCallback((filters = {}) => {
    filtersRef.current = filters;
    pageRef.current = 1;
    setPageState(1);
    return fetchData(filters, 1, pageSizeRef.current);
  }, [fetchData]);

  const setPage = useCallback((p) => {
    pageRef.current = p;
    setPageState(p);
    return fetchData(filtersRef.current, p, pageSizeRef.current);
  }, [fetchData]);

  const setPageSize = useCallback((s) => {
    pageSizeRef.current = s;
    setPageSizeState(s);
    pageRef.current = 1;
    setPageState(1);
    return fetchData(filtersRef.current, 1, s);
  }, [fetchData]);

  const applyEstado = useCallback((estado) => {
    const current = filtersRef.current;
    if ((current.estado || "all") === estado) {
      return Promise.resolve();
    }
    filtersRef.current = { ...current, estado };
    pageRef.current = 1;
    setPageState(1);
    return fetchData(filtersRef.current, 1, pageSizeRef.current);
  }, [fetchData]);

  const adjustStatsLocal = useCallback((activo, newEstado) => {
    const wasRevisado = String(activo.estadoinventario ?? "").toUpperCase() === "REVISADO";
    const isRevisado = String(newEstado ?? "").toUpperCase() === "REVISADO";
    if (wasRevisado === isRevisado) return;

    setTotalStats((prev) => ({
      ...prev,
      revisados: Math.max(0, prev.revisados + (isRevisado ? 1 : -1)),
      noRevisados: Math.max(0, prev.noRevisados + (isRevisado ? -1 : 1)),
    }));

    const email = activo.usuarioinventario;
    if (!email) return;
    setInventariadorStats((prev) =>
      prev.map((s) => {
        if (s.email !== email) return s;
        return {
          ...s,
          revisado: Math.max(0, s.revisado + (isRevisado ? 1 : -1)),
          pendiente: Math.max(0, s.pendiente + (isRevisado ? -1 : 1)),
        };
      }),
    );
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    await loadCatalogos();
    setIsLoading(false);
  }, [loadCatalogos]);

  const loadSummaryByUbicacion = useCallback(async ({ ciudad = "", inmueble = "" } = {}) => {
    setIsLoadingSummary(true);
    try {
      let ambienteCodes = null;
      if (ciudad || inmueble) {
        ambienteCodes = await resolveAmbienteCodes({ ciudad, inmueble });
      }

      const inmuebleTotal = await countActivosByUbicacion({ ciudad, inmueble });
      setSummaryInmuebleCount(inmuebleTotal);

      if (ambienteCodes == null) {
        setSummaryStats([]);
        return;
      }

      const CHUNK = 1000;
      let userRows = [];
      let start = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("act_activos")
          .select("usuarioinventario,estadoinventario")
          .eq("ultimoregistro", 1)
          .in("codigoambiente", ambienteCodes.length > 0 ? ambienteCodes : [-1])
          .range(start, start + CHUNK - 1);
        if (error) throw error;
        userRows = userRows.concat(data || []);
        if (!data || data.length < CHUNK) break;
        start += CHUNK;
      }
      setSummaryStats(aggregatePerUserRows(userRows));
    } catch (e) {
      console.error("Error loading summary by ubicacion:", e);
      setSummaryStats([]);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  const loadInmuebleSummary = useCallback(async ({ ciudad = "", inmueble = "" } = {}) => {
    const ambienteCodes = await resolveAmbienteCodes({ ciudad, inmueble });
    const totalInmueble = await countActivosByUbicacion({ ciudad, inmueble });
    if (!ambienteCodes || ambienteCodes.length === 0) {
      return { totalInmueble, totalInventariado: 0, totalEnProceso: 0, perUser: [] };
    }

    const CHUNK = 1000;
    let userRows = [];
    let start = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("act_activos")
        .select("usuarioinventario,estadoinventario")
        .eq("ultimoregistro", 1)
        .in("codigoambiente", ambienteCodes)
        .range(start, start + CHUNK - 1);
      if (error) throw error;
      userRows = userRows.concat(data || []);
      if (!data || data.length < CHUNK) break;
      start += CHUNK;
    }

    const acc = {};
    let totalInventariado = 0;
    let totalEnProceso = 0;
    userRows.forEach((r) => {
      const est = String(r.estadoinventario || "").trim().toUpperCase();
      if (est === "EN PROCESO") totalEnProceso += 1;
      const isInventariado = Boolean(est && est !== "PENDIENTE" && est !== "EN PROCESO");
      if (isInventariado) totalInventariado += 1;
      const email = r.usuarioinventario;
      if (!email) return;
      if (!acc[email]) acc[email] = { total: 0, inventariado: 0, enProceso: 0 };
      acc[email].total += 1;
      if (isInventariado) acc[email].inventariado += 1;
      if (est === "EN PROCESO") acc[email].enProceso += 1;
    });
    const perUser = Object.entries(acc).map(([email, counts]) => ({ email, ...counts }));
    return { totalInmueble, totalInventariado, totalEnProceso, perUser };
  }, []);

  const loadInmueblePendientes = useCallback(async ({ ciudad = "", inmueble = "" } = {}) => {
    const ambienteCodes = await resolveAmbienteCodes({ ciudad, inmueble });
    if (!ambienteCodes || ambienteCodes.length === 0) {
      return [];
    }
    const CHUNK = 1000;
    let rows = [];
    let start = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("act_activos")
        .select(ACTIVO_COLUMNS)
        .eq("ultimoregistro", 1)
        .in("codigoambiente", ambienteCodes)
        .or(
          'estadoinventario.is.null,estadoinventario.not.in.("INVENTARIADO","REVISADO","ENVIADO")',
        )
        .order("codigoactivo", { ascending: true })
        .range(start, start + CHUNK - 1);
      if (error) throw error;
      rows = rows.concat(data || []);
      if (!data || data.length < CHUNK) break;
      start += CHUNK;
    }
    return toCamelCaseArray(rows);
  }, []);

  const clearSummary = useCallback(() => {
    setSummaryStats(null);
    setSummaryInmuebleCount(0);
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize],
  );

  return {
    isLoading,
    activos,
    setActivos,
    rubros,
    tipoRubros,
    ambientes,
    responsables,
    ciudades,
    inmuebles,
    niveles,
    directAmbMap,
    directRespMap,
    ambientesRef,
    responsablesRef,
    directAmbRef,
    directRespRef,
    rubroDescMap,
    rubroFromTipo,
    tipoRubroDescMap,
    inventariadorStats,
    ambienteMap,
    responsableMap,
    totalStats,
    inmuebleCount,
    summaryStats,
    summaryInmuebleCount,
    isLoadingSummary,
    loadSummaryByUbicacion,
    clearSummary,
    loadInmuebleSummary,
    loadInmueblePendientes,
    page,
    pageSize,
    setPage,
    setPageSize,
    applyEstado,
    adjustStatsLocal,
    totalCount,
    totalPages,
    loadCatalogos,
    loadActivos,
    loadInitialData,
  };
};
