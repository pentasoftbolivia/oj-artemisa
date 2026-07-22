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
        query = query.or(
          `paterno.ilike.%${sf}%,materno.ilike.%${sf}%,nombre1.ilike.%${sf}%,nombre2.ilike.%${sf}%,cirun.ilike.%${sf}%`
        );
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

      const { data, error, count } = await query
        .order("codigoactivo", { ascending: true })
        .range(start, end);

      if (error) throw error;

      return {
        data: data || [],
        totalCount: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
