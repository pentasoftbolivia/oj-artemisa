import { createAsyncThunk } from "@reduxjs/toolkit";
import { getAllMovimientos } from "@/services/movimientosService";

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