import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "act_nivel";

export const fetchNiveles = createAsyncThunk(
  "nivel/fetchNiveles",
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
          .order("codigonivel", { ascending: true })
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

export const addNivel = createAsyncThunk(
  "nivel/addNivel",
  async (newNivel, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(newNivel))
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateNivel = createAsyncThunk(
  "nivel/updateNivel",
  async ({ codigonivel, updatedNivel }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedNivel))
        .eq("codigonivel", codigonivel)
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteNivel = createAsyncThunk(
  "nivel/deleteNivel",
  async (codigonivel, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("codigonivel", codigonivel);
      if (error) throw error;
      return codigonivel;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
