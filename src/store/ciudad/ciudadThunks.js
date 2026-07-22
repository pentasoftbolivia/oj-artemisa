import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "act_ciudad";

export const fetchCiudades = createAsyncThunk(
  "ciudad/fetchCiudades",
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
          .order("codigociudad", { ascending: true })
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

export const addCiudad = createAsyncThunk(
  "ciudad/addCiudad",
  async (newCiudad, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(newCiudad))
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateCiudad = createAsyncThunk(
  "ciudad/updateCiudad",
  async ({ codigociudad, updatedCiudad }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedCiudad))
        .eq("codigociudad", codigociudad)
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteCiudad = createAsyncThunk(
  "ciudad/deleteCiudad",
  async (codigociudad, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("codigociudad", codigociudad);
      if (error) throw error;
      return codigociudad;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
