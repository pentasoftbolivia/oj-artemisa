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
          .order("codigoactivointerno", { ascending: true })
          .range(start, start + CHUNK_SIZE - 1);

        if (fetchError) throw fetchError;

        const list = chunk || [];
        rows = rows.concat(list);
        if (list.length < CHUNK_SIZE) break;
        start += CHUNK_SIZE;
      }
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
