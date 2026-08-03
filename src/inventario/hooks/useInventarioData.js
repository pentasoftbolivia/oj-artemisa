import { useState, useCallback, useRef, useMemo } from "react";
import { supabase, fetchAllFromTable } from "@/lib/supabase";
import { toCamelCaseArray } from "@/lib/mapFields";
import { useToast } from "@/hooks/use-toast";
import { normalizeCi, normalizeCiLoose, getCiPrefix } from "../constants/inventarioConstants";

export const useInventarioData = () => {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [activos, setActivos] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [tipoRubros, setTipoRubros] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [responsables, setResponsables] = useState([]);

  const [directAmbMap, setDirectAmbMap] = useState({});
  const [directRespMap, setDirectRespMap] = useState({});
  const ambientesRef = useRef([]);
  const responsablesRef = useRef([]);
  const directAmbRef = useRef({});
  const directRespRef = useRef({});

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

  const inventariadorStats = useMemo(() => {
    const stats = {};
    (activos || []).forEach(a => {
      const email = a.usuarioinventario;
      if (!email) return;

      if (!stats[email]) {
        stats[email] = { aprobado: 0, pendiente: 0 };
      }

      if (a.estadoinventario === "APROBADO") {
        stats[email].aprobado++;
      } else {
        stats[email].pendiente++;
      }
    });
    return Object.entries(stats).map(([email, count]) => ({
      email,
      ...count
    }));
  }, [activos]);

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
    const [rubroRes, tipoRes] = await Promise.all([
      supabase.from("act_rubro").select("*").order("descripcionrubroact", { ascending: true }),
      supabase.from("act_tiporubro").select("*").order("descripciontiporubroact", { ascending: true }),
    ]);
    if (!rubroRes.error) setRubros(rubroRes.data || []);
    else console.error("Error loading rubros:", rubroRes.error);
    if (!tipoRes.error) setTipoRubros(tipoRes.data || []);
    else console.error("Error loading tipoRubros:", tipoRes.error);

    try {
      const [ambData, respData] = await Promise.all([
        fetchAllFromTable("act_ambiente", "*", { orderColumn: "ambiente", ascending: true }),
        fetchAllFromTable("act_responsable", "*", { orderColumn: "cirun", ascending: true }),
      ]);
      setAmbientes(ambData || []);
      ambientesRef.current = ambData || [];
      setResponsables(respData || []);
      responsablesRef.current = respData || [];
    } catch (err) {
      console.error("Error loading catalogos:", err);
    }
  }, []);

  const loadActivos = useCallback(async (filters = {}) => {
    const { codigoActivo = "", inventariador = "", carnet = "", nombre = "", all = false } = filters;
    setIsLoading(true);
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
          setIsLoading(false);
          return;
        }
        ciFilter = matchingResp.map(r => normalizeCi(r.cirun));
      }

      const BATCH_SIZE = 1000;
      let allData = [];
      let lastCodigoActivo = null;

      for (let i = 0; ; i++) {
        let batchQuery = supabase
          .from("act_activos")
          .select("*", { count: i === 0 ? "exact" : undefined })
          .eq("ultimoregistro", 1)
          .order("codigoactivointerno", { ascending: true })
          .limit(BATCH_SIZE);

        if (!all && !carnet && !nombre) {
          batchQuery = batchQuery.gte("codigoactivointerno", 335774);
        }

        if (lastCodigoActivo != null) {
          batchQuery = batchQuery.gt("codigoactivointerno", lastCodigoActivo);
        }

        if (codigoActivo.trim()) {
          const val = codigoActivo.trim().replace(/%/g, "");
          const numVal = Number(val);
          if (!isNaN(numVal)) {
            batchQuery = batchQuery.eq("codigoactivo", numVal);
          } else {
            batchQuery = batchQuery.eq("codigoactivo", -1);
          }
        }

        if (inventariador.trim()) {
          const val = inventariador.trim().replace(/%/g, "");
          batchQuery = batchQuery.ilike("usuarioinventario", `%${val}%`);
        }

        if (carnet.trim()) {
          const ci = carnet.trim().replace(/%/g, "");
          batchQuery = batchQuery.ilike("cirun", `%${ci}%`);
        }

        if (ciFilter.length > 0) {
          batchQuery = batchQuery.in("cirun", ciFilter);
        }

        const { data: batch, error: batchError } = await batchQuery;
        if (batchError) throw batchError;

        // if (i === 0) totalCount = count || 0; // totalCount is not used
        if (batch && batch.length > 0) {
          allData = allData.concat(batch);
          lastCodigoActivo = batch[batch.length - 1].codigoactivointerno;
        }
        if (!batch || batch.length < BATCH_SIZE) break;
      }

      const data = allData;

      const directAmb = {};
      if (data) {
        const uniqueAmbCodes = [...new Set(data.map(a => String(a.codigoambiente ?? "").trim()).filter(Boolean))];
        if (uniqueAmbCodes.length > 0) {
          const { data: ambData } = await supabase.from("act_ambiente").select("codigoambiente, ambiente").in("codigoambiente", uniqueAmbCodes);
          if (ambData) {
            ambData.forEach(a => { const code = String(a.codigoambiente ?? "").trim(); if (code) directAmb[code] = a.ambiente; });
          }
        }
      }
      setDirectAmbMap(directAmb);
      directAmbRef.current = directAmb;

      const directResp = {};
      if (data) {
        const uniqueCirs = [...new Set(data.map(a => String(a.cirun ?? "").trim()).filter(Boolean))];
        if (uniqueCirs.length > 0) {
          const { data: respData } = await supabase.from("act_responsable").select("*").in("cirun", uniqueCirs);
          if (respData) {
            respData.forEach(r => {
              const raw = String(r.cirun ?? "").trim();
              directResp[raw] = r;
              const norm = normalizeCi(r.cirun);
              if (norm !== raw) directResp[norm] = r;
              const loose = normalizeCiLoose(r.cirun);
              if (loose !== raw && loose !== norm) directResp[loose] = r;
              const prefix = getCiPrefix(raw);
              if (prefix && prefix !== raw && prefix !== norm && prefix !== loose) directResp[prefix] = r;
            });
          }
        }
      }
      setDirectRespMap(directResp);
      directRespRef.current = directResp;

      setActivos(toCamelCaseArray(data || []));
    } catch (err) {
      toast({ title: "Error", description: `Error al cargar activos: ${err.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    await loadCatalogos();
    setIsLoading(false);
  }, [loadCatalogos]);

  return {
    isLoading,
    activos,
    setActivos,
    rubros,
    tipoRubros,
    ambientes,
    responsables,
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
    loadCatalogos,
    loadActivos,
    loadInitialData,
  };
};
