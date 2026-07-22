import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "act_ambiente";

export const fetchAmbientes = createAsyncThunk(
  "ambiente/fetchAmbientes",
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
          .order("codigoambiente", { ascending: true })
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

export const addAmbiente = createAsyncThunk(
  "ambiente/addAmbiente",
  async (newAmbiente, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(newAmbiente))
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateAmbiente = createAsyncThunk(
  "ambiente/updateAmbiente",
  async ({ codigoambiente, updatedAmbiente }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedAmbiente))
        .eq("codigoambiente", codigoambiente)
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteAmbiente = createAsyncThunk(
  "ambiente/deleteAmbiente",
  async (codigoambiente, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("codigoambiente", codigoambiente);
      if (error) throw error;
      return codigoambiente;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
