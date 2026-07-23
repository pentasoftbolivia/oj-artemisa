import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";

const TABLE = "v_asignaciones";

const sanitize = (s) => (s || "").replace(/[%,]/g, "").trim();

export const fetchAsignaciones = createAsyncThunk(
  "asignaciones/fetchAsignaciones",
  async ({ page = 1, pageSize = 50, filters = {} } = {}, { rejectWithValue }) => {
    try {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from(TABLE)
        .select("*", { count: "exact" });

      const sf = sanitize(filters.searchFuncionario);
      if (sf) {
        const words = sf.split(/\s+/).filter(Boolean);
        for (const word of words) {
          query = query.or(
            `nombre1.ilike.%${word}%,paterno.ilike.%${word}%,materno.ilike.%${word}%,cirun.ilike.%${word}%`
          );
        }
      }

      const sa = sanitize(filters.searchActivo);
      if (sa) {
        query = query.or(
          `codigoactivo.ilike.%${sa}%,descripcionactivo.ilike.%${sa}%,serie.ilike.%${sa}%,marcamaterial.ilike.%${sa}%`
        );
      }

      const sg = sanitize(filters.searchGrupo);
      if (sg) {
        query = query.or(`grupo.ilike.%${sg}%`);
      }

      if (filters.estado && filters.estado !== "all") {
        const est = filters.estado.replace(/'/g, "").trim();
        query = query.eq("estado", est);
      }

      const { data, error, count } = await query.range(start, end);

      if (error) throw error;

      const extractNum = (code) => {
        const m = String(code || "").match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      };

      const sorted = [...(data || [])].sort(
        (a, b) => extractNum(a.codigoactivo) - extractNum(b.codigoactivo),
      );

      return {
        data: sorted,
        totalCount: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
