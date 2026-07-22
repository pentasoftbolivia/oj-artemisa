import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "act_activos";

export const fetchActivosFijos = createAsyncThunk(
  "activosFijos/fetchActivosFijos",
  async (_, { rejectWithValue }) => {
    try {
      let allData = [];
      let start = 0;
      const CHUNK_SIZE = 1000;
      let chunk;
      do {
        const { data, error } = await supabase
          .from(TABLE)
          .select("*")
          .order("codigoactivointerno", { ascending: true })
          .range(start, start + CHUNK_SIZE - 1);
        if (error) throw error;
        chunk = data || [];
        allData = allData.concat(chunk);
        start += CHUNK_SIZE;
      } while (chunk.length === CHUNK_SIZE);
      return toCamelCaseArray(allData);
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
