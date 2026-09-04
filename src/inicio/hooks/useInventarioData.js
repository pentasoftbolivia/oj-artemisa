import { useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { getCachedCatalog } from "@/lib/catalogCache";
import { resolveAmbienteCodes, countActivosByUbicacion } from "@/lib/ubicacionFilters";
import { useToast } from "@/hooks/use-toast";
import { normalizeCi, normalizeCiLoose, getCiPrefix, normalizarEstado } from "../constants/inventarioConstants";

const MIN_LOADING_MS = 400;

const ESTADO_FECHA_KEYS = {
  "EN PROCESO": "enProceso",
  INVENTARIADO: "inventariado",
  REVISADO: "revisado",
};

const aggregateActivosPorFecha = (rows) => {
  const acc = {};
  rows.forEach((r) => {
    const email = r.usuarioinventario;
    if (!email) return;
    if (!acc[email]) acc[email] = { enProceso: 0, inventariado: 0, revisado: 0, primerRegistro: null, ultimoRegistro: null };
    const key = ESTADO_FECHA_KEYS[String(r.estadoinventario || "").trim().toUpperCase()];
    if (key) acc[email][key] += 1;
    const fecha = r.fecharegistro ? String(r.fecharegistro) : null;
    if (fecha) {
      if (!acc[email].primerRegistro || fecha < acc[email].primerRegistro) acc[email].primerRegistro = fecha;
      if (!acc[email].ultimoRegistro || fecha > acc[email].ultimoRegistro) acc[email].ultimoRegistro = fecha;
    }
  });
  return Object.entries(acc)
    .map(([email, c]) => ({
      email,
      ...c,
      total: c.inventariado + c.revisado,
    }))
    .sort((a, b) => b.total - a.total);
};

const aggregatePerUserRows = (userRows) => {
  const acc = {};
  userRows.forEach((r) => {
    const email = r.usuarioinventario;
    if (!email) return;
    if (!acc[email]) acc[email] = { revisado: 0, pendiente: 0 };
    if (String(r.estadoinventario || "") === "REVISADO") {
      acc[email].revisado += 1;
    } else {
      acc[email].pendiente += 1;
    }
  });
  return Object.entries(acc)
    .map(([email, counts]) => ({ email, ...counts }))
    .sort((a, b) => b.revisado - a.revisado);
};

export const useInventarioData = () => {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [rubros, setRubros] = useState([]);
  const [tipoRubros, setTipoRubros] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [niveles, setNiveles] = useState([]);

  const ambientesRef = useRef([]);
  const responsablesRef = useRef([]);

  const [totalStats, setTotalStats] = useState({ total: 0, revisados: 0, noRevisados: 0 });
  const [universoTotal, setUniversoTotal] = useState(0);
  const [inventariadorStats, setInventariadorStats] = useState([]);

  const rubroDescMap = useMemo(() => {
    const map = {};
    (rubros || []).forEach((r) => {
      map[r.codigorubroact] = r.descripcionrubroact;
      map[String(r.codigorubroact)] = r.descripcionrubroact;
    });
    return map;
  }, [rubros]);

  const rubroFromTipo = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach((t) => {
      map[t.tiporubroact] = rubroDescMap[t.codigorubroact];
      map[String(t.tiporubroact)] = rubroDescMap[t.codigorubroact];
    });
    return map;
  }, [tipoRubros, rubroDescMap]);

  const tipoRubroDescMap = useMemo(() => {
    const map = {};
    (tipoRubros || []).forEach((t) => {
      map[t.tiporubroact] = t.descripciontiporubroact;
      map[String(t.tiporubroact)] = t.descripciontiporubroact;
    });
    return map;
  }, [tipoRubros]);

  const ambienteMap = useMemo(() => {
    const map = {};
    (ambientes.length > 0 ? ambientes : ambientesRef.current).forEach((a) => {
      const code = String(a.codigoambiente ?? "").trim();
      if (code) { map[code] = a.ambiente; }
    });
    return map;
  }, [ambientes]);

  const responsableMap = useMemo(() => {
    const map = {};
    (responsables.length > 0 ? responsables : responsablesRef.current).forEach((r) => {
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

    const [rubrosData, tipoRubrosData, ambientesData, responsablesData, ciudadesData, inmueblesData, nivelesData] =
      await Promise.all([
        safeGet("act_rubro"),
        safeGet("act_tiporubro"),
        safeGet("act_ambiente"),
        safeGet("act_responsable"),
        safeGet("act_ciudad"),
        safeGet("act_inmueble"),
        safeGet("act_nivel"),
      ]);

    setRubros(rubrosData || []);
    setTipoRubros(tipoRubrosData || []);
    setAmbientes(ambientesData || []);
    ambientesRef.current = ambientesData || [];
    setResponsables(responsablesData || []);
    responsablesRef.current = responsablesData || [];
    setCiudades(ciudadesData || []);
    setInmuebles(inmueblesData || []);
    setNiveles(nivelesData || []);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const startedAt = Date.now();
    try {
      const applyBaseFilters = (query) => {
        return query
          .eq("ultimoregistro", 1)
          .neq("estadoinventario", "EN PROCESO")
          .gte("codigoactivointerno", 335774);
      };

      const { count, error: countError } = await applyBaseFilters(
        supabase.from("act_activos").select("codigoactivointerno", { count: "exact", head: true })
      );
      if (countError) throw countError;

      let revisados = 0;
      try {
        const { count: revisadosCount, error: estadoError } = await applyBaseFilters(
          supabase.from("act_activos").select("codigoactivointerno", { count: "exact", head: true })
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
          const { data, error } = await applyBaseFilters(
            supabase.from("act_activos").select("usuarioinventario,estadoinventario")
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

      setTotalStats({ total: count || 0, revisados, noRevisados: (count || 0) - revisados });
      setInventariadorStats(perUser);
    } catch (err) {
      toast({ title: "Error", description: `Error al cargar estadísticas: ${err.message}`, variant: "destructive" });
    } finally {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }
      setIsLoading(false);
    }
  }, [toast]);

  const loadActivos = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    await loadCatalogos();
    try {
      const { count, error } = await supabase
        .from("act_activos")
        .select("codigoactivointerno", { count: "exact", head: true })
        .eq("ultimoregistro", 1);
      if (!error && typeof count === "number" && count > 0) {
        setUniversoTotal(count);
      }
    } catch (e) {
      console.error("Error loading universo total:", e);
    }
    setIsLoading(false);
  }, [loadCatalogos]);

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
        .order("codigoactivointerno", { ascending: true })
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
      const est = normalizarEstado(r.estadoinventario);
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
    const perUser = Object.entries(acc)
      .map(([email, counts]) => ({ email, ...counts }))
      .sort((a, b) => b.inventariado - a.inventariado);
    return { totalInmueble, totalInventariado, totalEnProceso, perUser };
  }, []);

  const fetchActivosPorAmbientes = useCallback(async ({ ambienteCodes = [], applyFilters } = {}) => {
    const CHUNK = 1000;
    let rows = [];
    let start = 0;
    for (;;) {
      let q = supabase
        .from("act_activos")
        .select("*, act_ambiente(ambiente), act_responsable(cirun, nombre1, nombre2, paterno, materno)")
        .eq("ultimoregistro", 1)
        .in("codigoambiente", ambienteCodes);
      if (applyFilters) {
        q = applyFilters(q);
      }
      const { data, error } = await q.range(start, start + CHUNK - 1);
      if (error) throw error;
      rows = rows.concat(data || []);
      if (!data || data.length < CHUNK) break;
      start += CHUNK;
    }
    return rows;
  }, []);

  const loadInmueblePendientes = useCallback(
    async ({ ciudad = "", inmueble = "", usuario = "" } = {}) => {
      const ambienteCodes = await resolveAmbienteCodes({ ciudad, inmueble });
      if (!ambienteCodes || ambienteCodes.length === 0) {
        return [];
      }
      const rows = await fetchActivosPorAmbientes({
        ambienteCodes,
        applyFilters: (q) => {
          let fq = q;
          if (usuario) fq = fq.eq("usuarioinventario", usuario);
          return fq;
        },
      });
      return rows.filter((r) => {
        const est = normalizarEstado(r.estadoinventario ?? r.estadoInventario);
        return !est || est === "PENDIENTE";
      });
    },
    [fetchActivosPorAmbientes],
  );

  const loadInmuebleInventariados = useCallback(
    async ({ ciudad = "", inmueble = "", usuario = "" } = {}) => {
      const ambienteCodes = await resolveAmbienteCodes({ ciudad, inmueble });
      if (!ambienteCodes || ambienteCodes.length === 0) {
        return [];
      }
      const rows = await fetchActivosPorAmbientes({
        ambienteCodes,
        applyFilters: (q) => {
          let fq = q;
          if (usuario) fq = fq.eq("usuarioinventario", usuario);
          return fq;
        },
      });
      return rows.filter((r) => {
        const est = normalizarEstado(r.estadoinventario ?? r.estadoInventario);
        return Boolean(est && est !== "PENDIENTE" && est !== "EN PROCESO");
      });
    },
    [fetchActivosPorAmbientes],
  );

  const loadInmuebleEnProceso = useCallback(
    async ({ ciudad = "", inmueble = "", usuario = "" } = {}) => {
      const ambienteCodes = await resolveAmbienteCodes({ ciudad, inmueble });
      if (!ambienteCodes || ambienteCodes.length === 0) {
        return [];
      }
      return fetchActivosPorAmbientes({
        ambienteCodes,
        applyFilters: (q) => {
          let fq = q.eq("estadoinventario", "EN PROCESO");
          if (usuario) fq = fq.eq("usuarioinventario", usuario);
          return fq;
        },
      });
    },
    [fetchActivosPorAmbientes],
  );

  const loadCiudadInmueblesStats = useCallback(async ({ ciudad = "" } = {}) => {
    const ciudadCode = String(ciudad || "").trim();
    if (!ciudadCode) return [];
    try {
      const srcInmuebles = inmuebles.length > 0 ? inmuebles : [];
      const srcNiveles = niveles.length > 0 ? niveles : [];
      const srcAmbientes = ambientes.length > 0 ? ambientes : (ambientesRef.current || []);
      const inmueblesRows = srcInmuebles.filter((r) => String(r.codigociudad ?? "").trim() === ciudadCode);
      if (inmueblesRows.length === 0) return [];
      const inmuebleCodes = inmueblesRows.map((r) => String(r.codigoinmueble).trim()).filter(Boolean);
      const inmuebleLabelMap = {};
      inmueblesRows.forEach((r) => { inmuebleLabelMap[String(r.codigoinmueble).trim()] = r.inmueble; });
      const nivelToInmueble = {};
      const nivelCodes = [];
      srcNiveles.forEach((r) => {
        const inm = String(r.codigoinmueble ?? "").trim();
        const niv = String(r.codigonivel ?? "").trim();
        if (inmuebleCodes.includes(inm) && niv) { nivelToInmueble[niv] = inm; nivelCodes.push(niv); }
      });
      if (nivelCodes.length === 0) return [];
      const ambienteToInmueble = {};
      const allAmbienteCodes = [];
      srcAmbientes.forEach((r) => {
        const niv = String(r.codigonivel ?? "").trim();
        const amb = String(r.codigoambiente ?? "").trim();
        const inm = nivelToInmueble[niv];
        if (amb && inm) { ambienteToInmueble[amb] = inm; allAmbienteCodes.push(amb); }
      });
      if (allAmbienteCodes.length === 0) return [];
      const CHUNK = 1000;
      let activosRows = [];
      let start = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("act_activos")
          .select("codigoambiente,estadoinventario")
          .eq("ultimoregistro", 1)
          .in("codigoambiente", allAmbienteCodes)
          .range(start, start + CHUNK - 1);
        if (error) throw error;
        activosRows = activosRows.concat(data || []);
        if (!data || data.length < CHUNK) break;
        start += CHUNK;
      }
      const acc = {};
      inmuebleCodes.forEach((code) => { acc[code] = { totalInmueble: 0, totalInventariado: 0, totalEnProceso: 0 }; });
      (activosRows || []).forEach((r) => {
        const amb = String(r.codigoambiente || "").trim();
        const inm = ambienteToInmueble[amb];
        if (!inm || !acc[inm]) return;
        acc[inm].totalInmueble += 1;
        const est = normalizarEstado(r.estadoinventario);
        if (est === "EN PROCESO") acc[inm].totalEnProceso += 1;
        const isInventariado = Boolean(est && est !== "PENDIENTE" && est !== "EN PROCESO");
        if (isInventariado) acc[inm].totalInventariado += 1;
      });
      return inmuebleCodes.map((code) => {
        const { totalInmueble, totalInventariado, totalEnProceso } = acc[code];
        const porcentaje = totalInmueble > 0 ? (totalInventariado / totalInmueble) * 100 : 0;
        return {
          codigoinmueble: code,
          inmueble: inmuebleLabelMap[code] || code,
          totalInmueble,
          totalInventariado,
          totalEnProceso,
          porcentaje: Number(porcentaje.toFixed(2)),
        };
      }).filter((s) => s.totalInmueble > 0).sort((a, b) => a.inmueble.localeCompare(b.inmueble));
    } catch (e) {
      console.error("Error loading ciudad inmuebles stats:", e);
      return [];
    }
  }, [inmuebles, niveles, ambientes]);

  const loadActivosPorFecha = useCallback(async ({ fechaDesde, fechaHasta } = {}) => {
    const start = `${fechaDesde}T00:00:00`;
    const end = `${fechaHasta}T23:59:59.999`;
    const CHUNK = 1000;
    let rows = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("act_activos")
        .select("usuarioinventario, estadoinventario, fecharegistro")
        .eq("ultimoregistro", 1)
        .gte("fecharegistro", start)
        .lte("fecharegistro", end)
        .range(offset, offset + CHUNK - 1);
      if (error) throw error;
      rows = rows.concat(data || []);
      if (!data || data.length < CHUNK) break;
      offset += CHUNK;
    }

    return {
      aggregated: aggregateActivosPorFecha(rows),
      rawRows: rows,
    };
  }, []);

  return {
    isLoading,
    rubros,
    tipoRubros,
    ambientes,
    responsables,
    ciudades,
    inmuebles,
    niveles,
    rubroFromTipo,
    tipoRubroDescMap,
    inventariadorStats,
    ambienteMap,
    responsableMap,
    totalStats,
    universoTotal,
    loadInmuebleSummary,
    loadInmueblePendientes,
    loadInmuebleInventariados,
    loadInmuebleEnProceso,
    loadCiudadInmueblesStats,
    loadActivosPorFecha,
    loadCatalogos,
    loadActivos,
    loadInitialData,
  };
};
