import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  getAllMovimientos,
  createMovimiento,
  editMovimiento,
  removeMovimiento,
  getDetalles,
} from "@/services/movimientosService";

export const fetchMovimientos = createAsyncThunk(
  "movimientos/fetchMovimientos",
  async (_, { rejectWithValue }) => {
    try {
      const data = await getAllMovimientos();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addMovimiento = createAsyncThunk(
  "movimientos/addMovimiento",
  async ({ cabecera, detalles }, { rejectWithValue }) => {
    try {
      const result = await createMovimiento(cabecera, detalles);
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateMovimiento = createAsyncThunk(
  "movimientos/updateMovimiento",
  async ({ id, cabecera, detalles }, { rejectWithValue }) => {
    try {
      const result = await editMovimiento(id, cabecera, detalles);
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteMovimiento = createAsyncThunk(
  "movimientos/deleteMovimiento",
  async (id, { rejectWithValue }) => {
    try {
      await removeMovimiento(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDetallesByMovimientoId = createAsyncThunk(
  "movimientos/fetchDetallesByMovimientoId",
  async (movimientoId, { rejectWithValue }) => {
    try {
      const data = await getDetalles(movimientoId);
      return { movimientoId, detalles: data };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
