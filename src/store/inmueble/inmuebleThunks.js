import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "act_inmueble";

export const fetchInmuebles = createAsyncThunk(
  "inmueble/fetchInmuebles",
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
          .order("codigoinmueble", { ascending: true })
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

export const addInmueble = createAsyncThunk(
  "inmueble/addInmueble",
  async (newInmueble, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(newInmueble))
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateInmueble = createAsyncThunk(
  "inmueble/updateInmueble",
  async ({ codigoinmueble, updatedInmueble }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedInmueble))
        .eq("codigoinmueble", codigoinmueble)
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteInmueble = createAsyncThunk(
  "inmueble/deleteInmueble",
  async (codigoinmueble, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("codigoinmueble", codigoinmueble);
      if (error) throw error;
      return codigoinmueble;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
