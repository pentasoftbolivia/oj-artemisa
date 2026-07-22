import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchAllRows, createRow, updateRow, deleteRow } from "@/services/baseService";
import { toSnakeCase, toCamelCaseArray, toCamelCase } from "@/lib/mapFields";

const TABLE = "asignaciones";
export const fetchAsignaciones = createAsyncThunk(
  "asignaciones/fetchAsignaciones",
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchAllRows(TABLE);
      return toCamelCaseArray(data);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addAsignacion = createAsyncThunk(
  "asignaciones/addAsignacion",
  async (newAsignacion, { rejectWithValue }) => {
    try {
      const data = await createRow(TABLE, toSnakeCase(newAsignacion));
      return toCamelCase(data);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateAsignacion = createAsyncThunk(
  "asignaciones/updateAsignacion",
  async ({ id, updatedAsignacion }, { rejectWithValue }) => {
    try {
      const data = await updateRow(TABLE, id, toSnakeCase(updatedAsignacion));
      return toCamelCase(data);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteAsignacion = createAsyncThunk(
  "asignaciones/deleteAsignacion",
  async (id, { rejectWithValue }) => {
    try {
      await deleteRow(TABLE, id);
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
