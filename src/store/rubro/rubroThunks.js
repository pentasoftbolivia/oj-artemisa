import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "act_rubro";

export const fetchRubros = createAsyncThunk(
  "rubro/fetchRubros",
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
          .order("codigorubroact", { ascending: true })
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

export const addRubro = createAsyncThunk(
  "rubro/addRubro",
  async (newRubro, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(newRubro))
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateRubro = createAsyncThunk(
  "rubro/updateRubro",
  async ({ codigorubroact, updatedRubro }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedRubro))
        .eq("codigorubroact", codigorubroact)
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteRubro = createAsyncThunk(
  "rubro/deleteRubro",
  async (codigorubroact, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("codigorubroact", codigorubroact);
      if (error) throw error;
      return codigorubroact;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
