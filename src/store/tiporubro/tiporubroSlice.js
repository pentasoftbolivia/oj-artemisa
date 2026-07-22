import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchTipoRubros,
  addTipoRubro,
  updateTipoRubro,
  deleteTipoRubro
} from './tiporubroThunks';

const tiporubroSlice = createSlice({
  name: 'tiporubro',
  initialState: { data: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTipoRubros.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchTipoRubros.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; state.error = null; })
      .addCase(fetchTipoRubros.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload || action.error.message; state.data = []; })
      .addCase(addTipoRubro.fulfilled, (state, action) => { state.data.push(action.payload); })
      .addCase(addTipoRubro.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(updateTipoRubro.fulfilled, (state, action) => { const i = state.data.findIndex(a => a.tiporubroact === action.payload.tiporubroact); if (i !== -1) state.data[i] = action.payload; })
      .addCase(updateTipoRubro.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(deleteTipoRubro.fulfilled, (state, action) => { state.data = state.data.filter(a => a.tiporubroact !== action.payload); })
      .addCase(deleteTipoRubro.rejected, (state, action) => { state.error = action.payload || action.error.message; });
  },
});

export const selectTipoRubros = createSelector(
  (state) => state.tiporubro?.data || [],
  (a) => (Array.isArray(a) ? a : [])
);
export const selectTipoRubrosLoading = createSelector(
  (state) => state.tiporubro?.status,
  (s) => Boolean(s === 'loading')
);
export const selectTipoRubrosError = createSelector(
  (state) => state.tiporubro?.error,
  (e) => (e === null || e === undefined ? null : String(e))
);

export default tiporubroSlice.reducer;
