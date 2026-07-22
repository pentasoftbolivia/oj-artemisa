import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchActivosFijos, addActivoFijo, updateActivoFijo, deleteActivoFijo
} from './activosFijosThunks';

const activosFijosSlice = createSlice({
  name: 'activosFijos',
  initialState: { data: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivosFijos.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchActivosFijos.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; state.error = null; })
      .addCase(fetchActivosFijos.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload || action.error.message; state.data = []; })
      .addCase(addActivoFijo.fulfilled, (state, action) => { state.data.push(action.payload); })
      .addCase(addActivoFijo.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(updateActivoFijo.fulfilled, (state, action) => { const i = state.data.findIndex(a => a.codigoActivoInterno === action.payload.codigoActivoInterno); if (i !== -1) state.data[i] = action.payload; })
      .addCase(updateActivoFijo.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(deleteActivoFijo.fulfilled, (state, action) => { state.data = state.data.filter(a => a.codigoActivoInterno !== action.payload); })
      .addCase(deleteActivoFijo.rejected, (state, action) => { state.error = action.payload || action.error.message; });
  },
});

export const selectActivosFijos = createSelector(
  (state) => state.activosFijos?.data || [],
  (a) => (Array.isArray(a) ? a : [])
);
export const selectActivosFijosLoading = createSelector(
  (state) => state.activosFijos?.status,
  (s) => Boolean(s === 'loading')
);
export const selectActivosFijosError = createSelector(
  (state) => state.activosFijos?.error,
  (e) => (e === null || e === undefined ? null : String(e))
);

export default activosFijosSlice.reducer;
