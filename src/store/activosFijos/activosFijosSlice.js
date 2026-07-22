import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchActivosFijosPaginated, addActivoFijo, updateActivoFijo, deleteActivoFijo
} from './activosFijosThunks';

const activosFijosSlice = createSlice({
  name: 'activosFijos',
  initialState: {
    data: [],
    totalCount: 0,
    currentPage: 1,
    pageSize: 100,
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivosFijosPaginated.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchActivosFijosPaginated.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload.data;
        state.totalCount = action.payload.totalCount;
        state.currentPage = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.error = null;
      })
      .addCase(fetchActivosFijosPaginated.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
        state.data = [];
        state.totalCount = 0;
      })
      .addCase(addActivoFijo.fulfilled, (state) => {
        state.data = [];
        state.totalCount = 0;
      })
      .addCase(addActivoFijo.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(updateActivoFijo.fulfilled, (state) => {
        state.data = [];
        state.totalCount = 0;
      })
      .addCase(updateActivoFijo.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteActivoFijo.fulfilled, (state) => {
        state.data = [];
        state.totalCount = 0;
      })
      .addCase(deleteActivoFijo.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      });
  },
});

export const selectActivosFijos = (state) => state.activosFijos?.data ?? [];

export const selectActivosFijosTotalCount = (state) => state.activosFijos?.totalCount ?? 0;

export const selectActivosFijosLoading = createSelector(
  (state) => state.activosFijos?.status,
  (s) => s === 'loading'
);

export const selectActivosFijosError = createSelector(
  (state) => state.activosFijos?.error,
  (e) => (e == null ? null : String(e))
);

export default activosFijosSlice.reducer;
