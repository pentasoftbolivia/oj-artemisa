import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";
import { normalizeCi } from "@/inventario/constants/inventarioConstants";
import { resolveAmbienteCodes } from "@/lib/ubicacionFilters";

const TABLE = "act_activos";

const normalizePayload = (payload) => {
  if (payload.cirun != null) {
    return { ...payload, cirun: normalizeCi(payload.cirun) };
  }
  return payload;
};

export const fetchActivosFijosPaginated = createAsyncThunk(
  "activosFijos/fetchActivosFijosPaginated",
  async ({ page = 1, pageSize = 100, filters = {} } = {}, { rejectWithValue }) => {
    try {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from(TABLE)
        .select("*", { count: "exact" })
        .eq("ultimoregistro", 1)
        .eq("estadoinventario", "REVISADO")
        .order("codigoactivointerno", { ascending: true })
        .range(start, end);

      if (filters.search) {
        const s = filters.search.replace(/%/g, "").trim();
        if (s) {
          const searchNum = Number(s);
          if (!isNaN(searchNum)) {
            query = query.or(`codigoactivo.eq.${searchNum},cirun.ilike.%${s}%`);
          } else {
            const words = s.split(/\s+/).filter(Boolean);
            words.forEach((word) => {
              query = query.or(`descripcionactivo.ilike.%${word}%,cirun.ilike.%${word}%`);
            });
          }
        }
      }

      if (filters.carnet) {
        const c = filters.carnet.replace(/%/g, "").trim();
        if (c) {
          const words = c.split(/\s+/).filter(Boolean);
          words.forEach((word) => {
            query = query.ilike("cirun", `%${word}%`);
          });
        }
      }

      if (filters.rubro && Array.isArray(filters.rubro)) {
        query = query.in("tiporubroact", filters.rubro.length > 0 ? filters.rubro : [-1]);
      }

      if (filters.ambiente) {
        query = query.eq("codigoambiente", filters.ambiente);
      } else if (filters.nivel || filters.inmueble || filters.ciudad) {
        const codes = await resolveAmbienteCodes({
          ciudad: filters.ciudad,
          inmueble: filters.inmueble,
          nivel: filters.nivel,
        });
        query = query.in("codigoambiente", codes && codes.length > 0 ? codes : [-1]);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        data: toCamelCaseArray(data || []),
        totalCount: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addActivoFijo = createAsyncThunk(
  "activosFijos/addActivoFijo",
  async (newActivoFijo, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(normalizePayload(newActivoFijo)))
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateActivoFijo = createAsyncThunk(
  "activosFijos/updateActivoFijo",
  async ({ codigoActivoInterno, updatedActivoFijo }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(normalizePayload(updatedActivoFijo)))
        .eq("codigoactivointerno", codigoActivoInterno)
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteActivoFijo = createAsyncThunk(
  "activosFijos/deleteActivoFijo",
  async (codigoActivoInterno, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("codigoactivointerno", codigoActivoInterno);
      if (error) throw error;
      return codigoActivoInterno;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
