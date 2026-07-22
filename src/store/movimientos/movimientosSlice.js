import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchMovimientos,
  addMovimiento,
  updateMovimiento,
  deleteMovimiento,
  fetchDetallesByMovimientoId,
} from './movimientosThunks';

const movimientosSlice = createSlice({
  name: 'movimientos',
  initialState: {
    data: [],
    status: 'idle',
    error: null,
    detallesPorMovimiento: {},
  },
  reducers: {
    clearDetalles: (state) => {
      state.detallesPorMovimiento = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMovimientos.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchMovimientos.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
        state.error = null;
      })
      .addCase(fetchMovimientos.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
        state.data = [];
      })
      .addCase(addMovimiento.fulfilled, (state, action) => {
        state.data.push(action.payload.cabecera);
        if (action.payload.detalles?.length) {
          state.detallesPorMovimiento[action.payload.cabecera.id] = action.payload.detalles;
        }
      })
      .addCase(addMovimiento.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(updateMovimiento.fulfilled, (state, action) => {
        const index = state.data.findIndex((m) => m.id === action.payload.cabecera.id);
        if (index !== -1) {
          state.data[index] = action.payload.cabecera;
        }
        if (action.payload.detalles?.length) {
          state.detallesPorMovimiento[action.payload.cabecera.id] = action.payload.detalles;
        }
      })
      .addCase(updateMovimiento.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteMovimiento.fulfilled, (state, action) => {
        state.data = state.data.filter((m) => m.id !== action.payload);
        delete state.detallesPorMovimiento[action.payload];
      })
      .addCase(deleteMovimiento.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(fetchDetallesByMovimientoId.fulfilled, (state, action) => {
        state.detallesPorMovimiento[action.payload.movimientoId] = action.payload.detalles;
      })
      .addCase(fetchDetallesByMovimientoId.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearDetalles } = movimientosSlice.actions;

export const selectMovimientos = createSelector(
  (state) => state.movimientos?.data || [],
  (movimientos) => (Array.isArray(movimientos) ? [...movimientos] : [])
);

export const selectMovimientosLoading = createSelector(
  (state) => state.movimientos?.status,
  (status) => Boolean(status === 'loading')
);

export const selectMovimientosError = createSelector(
  (state) => state.movimientos?.error,
  (error) => (error === null || error === undefined ? null : String(error))
);

export const selectDetallesByMovimientoId = createSelector(
  (state) => state.movimientos?.detallesPorMovimiento || {},
  (state, movimientoId) => movimientoId,
  (detallesMap, movimientoId) => detallesMap[movimientoId] || null
);

export default movimientosSlice.reducer;
