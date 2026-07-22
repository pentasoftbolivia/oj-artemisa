import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchAsignaciones,
  addAsignacion,
  updateAsignacion,
  deleteAsignacion
} from './asignacionesThunks';

const asignacionesSlice = createSlice({
  name: 'asignaciones',
  initialState: {
    data: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAsignaciones.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAsignaciones.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
        state.error = null;
      })
      .addCase(fetchAsignaciones.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
        state.data = [];
      })
      .addCase(addAsignacion.fulfilled, (state, action) => {
        state.data.push(action.payload);
      })
      .addCase(addAsignacion.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(updateAsignacion.fulfilled, (state, action) => {
        const index = state.data.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(updateAsignacion.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteAsignacion.fulfilled, (state, action) => {
        state.data = state.data.filter(a => a.id !== action.payload);
      })
      .addCase(deleteAsignacion.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      });
  },
});

export const selectSortedAsignaciones = createSelector(
  (state) => state.asignaciones?.data || [],
  (asignaciones) => {
    if (!Array.isArray(asignaciones)) return [];
    return [...asignaciones].sort((a, b) => a.id - b.id);
  }
);

export const selectAsignacionesLoading = createSelector(
  (state) => state.asignaciones?.status,
  (status) => Boolean(status === 'loading')
);

export const selectAsignacionesError = createSelector(
  (state) => state.asignaciones?.error,
  (error) => (error === null || error === undefined ? null : String(error))
);

export default asignacionesSlice.reducer;
