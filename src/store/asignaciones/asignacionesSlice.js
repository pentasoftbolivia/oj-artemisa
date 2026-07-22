import { createSlice, createSelector } from '@reduxjs/toolkit';
import { fetchAsignaciones } from './asignacionesThunks';

const asignacionesSlice = createSlice({
  name: 'asignaciones',
  initialState: {
    data: [],
    totalCount: 0,
    currentPage: 1,
    pageSize: 50,
    status: 'idle',
    error: null,
  },
  reducers: {
    resetAsignaciones: (state) => {
      state.data = [];
      state.totalCount = 0;
      state.currentPage = 1;
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAsignaciones.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAsignaciones.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload.data;
        state.totalCount = action.payload.totalCount;
        state.currentPage = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.error = null;
      })
      .addCase(fetchAsignaciones.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
        state.data = [];
        state.totalCount = 0;
      });
  },
});

export const { resetAsignaciones } = asignacionesSlice.actions;

export const selectAsignacionesData = (state) => state.asignaciones?.data ?? [];

export const selectAsignacionesTotalCount = (state) =>
  state.asignaciones?.totalCount ?? 0;

export const selectAsignacionesPage = (state) =>
  state.asignaciones?.currentPage ?? 1;

export const selectAsignacionesPageSize = (state) =>
  state.asignaciones?.pageSize ?? 50;

export const selectAsignacionesLoading = createSelector(
  (state) => state.asignaciones?.status,
  (status) => Boolean(status === 'loading')
);

export const selectAsignacionesError = createSelector(
  (state) => state.asignaciones?.error,
  (error) => (error === null || error === undefined ? null : String(error))
);

export default asignacionesSlice.reducer;
