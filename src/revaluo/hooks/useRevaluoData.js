import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVO_COLUMNS } from "@/lib/activoColumns";

const CHUNK_SIZE = 1000;

export const useRevaluoData = () => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRevaluo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let rows = [];
      let start = 0;
      for (;;) {
        const { data: chunk, error: fetchError } = await supabase
          .from("act_activos")
          .select(ACTIVO_COLUMNS)
          .eq("pararevaluo", true)
          .eq("estado", 1)
          .eq("ultimoregistro", 1)
          .not("estadoinventario", "is", null)
          .neq("estadoinventario", "")
          .order("codigoactivointerno", { ascending: true })
          .range(start, start + CHUNK_SIZE - 1);

        if (fetchError) throw fetchError;

        const list = chunk || [];
        rows = rows.concat(list);
        if (list.length < CHUNK_SIZE) break;
        start += CHUNK_SIZE;
      }
      // Refuerzo en cliente: pararevaluo=true, estado=1, ultimoregistro=1
      // y estadoinventario con dato (incluye estadoconservacion=MALO)
      rows = rows.filter((r) => {
        const v = r.pararevaluo ?? r.paraRevaluo;
        const esParaRevaluo =
          v === true || v === 1
            ? true
            : ["TRUE", "1", "T"].includes(String(v ?? "").trim().toUpperCase());
        if (!esParaRevaluo) return false;
        const estadoRaw = r.estado;
        const esAlta =
          estadoRaw === 1 || estadoRaw === true
            ? true
            : ["1", "TRUE", "T", "ALTA"].includes(String(estadoRaw ?? "").trim().toUpperCase());
        if (!esAlta) return false;
        const ultimoVal = String(r.ultimoregistro ?? "").trim();
        if (ultimoVal !== "1") return false;
        return String(r.estadoinventario ?? "").trim() !== "";
      });
      setData(rows);
    } catch (err) {
      setError(err.message || "Error al cargar activos para revalúo");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchRevaluo };
};
