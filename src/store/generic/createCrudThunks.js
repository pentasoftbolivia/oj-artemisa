import { createAsyncThunk } from "@reduxjs/toolkit";
import { supabase, fetchAllFromTable } from "@/lib/supabase";
import { toSnakeCase, toCamelCaseArray } from "@/lib/mapFields";
import { invalidateCatalog } from "@/lib/catalogCache";

export const createCrudThunks = ({ prefix, table, idColumn, updatedKey, select = "*" }) => {
  const fetchAll = createAsyncThunk(
    `${prefix}/fetchAll`,
    async (_, { rejectWithValue }) => {
      try {
        const rows = await fetchAllFromTable(table, select, {
          orderColumn: idColumn,
          ascending: true,
        });
        return toCamelCaseArray(rows);
      } catch (error) {
        return rejectWithValue(error.message);
      }
    }
  );

  const add = createAsyncThunk(
    `${prefix}/add`,
    async (payload, { rejectWithValue }) => {
      try {
        const { data, error } = await supabase
          .from(table)
          .insert(toSnakeCase(payload))
          .select("*")
          .single();
        if (error) throw error;
        invalidateCatalog(table);
        return toCamelCaseArray([data])[0];
      } catch (error) {
        return rejectWithValue(error.message);
      }
    }
  );

  const update = createAsyncThunk(
    `${prefix}/update`,
    async ({ [idColumn]: id, [updatedKey]: entity }, { rejectWithValue }) => {
      try {
        const { data, error } = await supabase
          .from(table)
          .update(toSnakeCase(entity))
          .eq(idColumn, id)
          .select("*")
          .single();
        if (error) throw error;
        invalidateCatalog(table);
        return toCamelCaseArray([data])[0];
      } catch (error) {
        return rejectWithValue(error.message);
      }
    }
  );

  const remove = createAsyncThunk(
    `${prefix}/remove`,
    async (id, { rejectWithValue }) => {
      try {
        const { error } = await supabase.from(table).delete().eq(idColumn, id);
        if (error) throw error;
        invalidateCatalog(table);
        return id;
      } catch (error) {
        return rejectWithValue(error.message);
      }
    }
  );

  return { fetchAll, add, update, remove };
};
