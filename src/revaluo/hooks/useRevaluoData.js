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
      const SELECT_COLS = `${ACTIVO_COLUMNS},esactivo,activonuevo,pararevaluo,estadoconservacion,artemisaaltabaja`;

      const fetchGroup = async (queryBuilder) => {
        let rows = [];
        let start = 0;
        for (;;) {
          const { data: chunk, error: fetchError } = await queryBuilder
            .order("codigoactivointerno", { ascending: true })
            .range(start, start + CHUNK_SIZE - 1);

          if (fetchError) throw fetchError;

          const list = chunk || [];
          rows = rows.concat(list);
          if (list.length < CHUNK_SIZE) break;
          start += CHUNK_SIZE;
        }
        return rows;
      };

      // Grupo 1 — Estado Baja
      const q1 = supabase
        .from("act_activos")
        .select(SELECT_COLS)
        .lte("codigoactivo", 43753)
        .not("estadoinventario", "is", null)
        .neq("estadoinventario", "")
        .eq("artemisaaltabaja", 0)
        .eq("ultimoregistro", 1)
        .eq("esactivo", true)
        .neq("estadoconservacion", "MALO");

      // Grupo 2 — No son MALO
      const q2 = supabase
        .from("act_activos")
        .select(SELECT_COLS)
        .lte("codigoactivo", 43753)
        .not("estadoinventario", "is", null)
        .neq("estadoinventario", "")
        .eq("artemisaaltabaja", 1)
        .eq("pararevaluo", true)
        .eq("activonuevo", false)
        .neq("estadoconservacion", "MALO");

      // Grupo 3 — Códigos nuevos
      const q3 = supabase
        .from("act_activos")
        .select(SELECT_COLS)
        .eq("activonuevo", true);

      const [rows1, rows2, rows3] = await Promise.all([
        fetchGroup(q1),
        fetchGroup(q2),
        fetchGroup(q3),
      ]);

      const rows1Tagged = rows1.map((r) => ({ ...r, grupo: "Grupo 1 — Estado Baja" }));
      const rows2Tagged = rows2.map((r) => ({ ...r, grupo: "Grupo 2 — No son MALO" }));
      const rows3Tagged = rows3.map((r) => ({ ...r, grupo: "Grupo 3 — Códigos nuevos" }));

      // Unir y eliminar duplicados por codigoactivointerno
      const map = new Map();
      [...rows1Tagged, ...rows2Tagged, ...rows3Tagged].forEach((r) => {
        const key = r.codigoactivointerno ?? r.codigoActivoInterno;
        if (!map.has(key)) map.set(key, r);
      });

      const rows = Array.from(map.values());

      // Ordenar por grupo y luego por codigoactivo ASC
      const grupoOrder = {
        "Grupo 1 — Estado Baja": 1,
        "Grupo 2 — No son MALO": 2,
        "Grupo 3 — Códigos nuevos": 3,
      };

      rows.sort((a, b) => {
        const ga = grupoOrder[a.grupo] ?? 99;
        const gb = grupoOrder[b.grupo] ?? 99;
        if (ga !== gb) return ga - gb;
        const ca = Number(a.codigoactivo ?? a.codigoActivo ?? 0);
        const cb = Number(b.codigoactivo ?? b.codigoActivo ?? 0);
        return ca - cb;
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
