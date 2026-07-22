import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "act_tiporubro";

export const fetchTipoRubros = createAsyncThunk(
  "tiporubro/fetchTipoRubros",
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
          .order("tiporubroact", { ascending: true })
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

export const addTipoRubro = createAsyncThunk(
  "tiporubro/addTipoRubro",
  async (newTipoRubro, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(newTipoRubro))
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateTipoRubro = createAsyncThunk(
  "tiporubro/updateTipoRubro",
  async ({ tiporubroact, updatedTipoRubro }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedTipoRubro))
        .eq("tiporubroact", tiporubroact)
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteTipoRubro = createAsyncThunk(
  "tiporubro/deleteTipoRubro",
  async (tiporubroact, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("tiporubroact", tiporubroact);
      if (error) throw error;
      return tiporubroact;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
