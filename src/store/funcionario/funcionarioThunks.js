import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";

const TABLE = "funcionario";

export const fetchFuncionario = createAsyncThunk(
  "funcionario/fetchFuncionario",
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
          .order("cirun", { ascending: true })
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

export const addFuncionario = createAsyncThunk(
  "funcionario/addFuncionario",
  async (newFuncionario, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(toSnakeCase(newFuncionario))
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateFuncionario = createAsyncThunk(
  "funcionario/updateFuncionario",
  async ({ cirun, updatedFuncionario }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toSnakeCase(updatedFuncionario))
        .eq("cirun", cirun)
        .select("*")
        .single();
      if (error) throw error;
      return toCamelCaseArray([data])[0];
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteFuncionario = createAsyncThunk(
  "funcionario/deleteFuncionario",
  async (cirun, { rejectWithValue }) => {
    try {
      const { error } = await supabase.from(TABLE).delete().eq("cirun", cirun);
      if (error) throw error;
      return cirun;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
