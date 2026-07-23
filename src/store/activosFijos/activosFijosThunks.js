import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "act_activos";

export const fetchActivosFijosPaginated = createAsyncThunk(
  "activosFijos/fetchActivosFijosPaginated",
  async ({ page = 1, pageSize = 100, filters = {} } = {}, { rejectWithValue }) => {
    try {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from(TABLE)
        .select("*", { count: "exact" })
        .order("codigoactivointerno", { ascending: true })
        .range(start, end);

      if (filters.search) {
        const s = filters.search.replace(/%/g, "").trim();
        if (s) {
          const searchNum = Number(s);
          if (!isNaN(searchNum)) {
            query = query.or(`codigoactivo.eq.${searchNum}`);
          } else {
            query = query.or(`descripcionactivo.ilike.%${s}%,cirun.ilike.%${s}%`);
          }
        }
      }

      if (filters.rubro && Array.isArray(filters.rubro) && filters.rubro.length > 0) {
        query = query.in("tiporubroact", filters.rubro);
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
        .insert(toSnakeCase(newActivoFijo))
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
        .update(toSnakeCase(updatedActivoFijo))
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
