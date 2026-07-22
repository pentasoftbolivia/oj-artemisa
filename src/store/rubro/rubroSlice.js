import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchRubros,
  addRubro,
  updateRubro,
  deleteRubro
} from './rubroThunks';

const rubroSlice = createSlice({
  name: 'rubro',
  initialState: { data: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRubros.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchRubros.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; state.error = null; })
      .addCase(fetchRubros.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload || action.error.message; state.data = []; })
      .addCase(addRubro.fulfilled, (state, action) => { state.data.push(action.payload); })
      .addCase(addRubro.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(updateRubro.fulfilled, (state, action) => { const i = state.data.findIndex(a => a.codigorubroact === action.payload.codigorubroact); if (i !== -1) state.data[i] = action.payload; })
      .addCase(updateRubro.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(deleteRubro.fulfilled, (state, action) => { state.data = state.data.filter(a => a.codigorubroact !== action.payload); })
      .addCase(deleteRubro.rejected, (state, action) => { state.error = action.payload || action.error.message; });
  },
});

export const selectRubros = createSelector(
  (state) => state.rubro?.data || [],
  (a) => (Array.isArray(a) ? a : [])
);
export const selectRubrosLoading = createSelector(
  (state) => state.rubro?.status,
  (s) => Boolean(s === 'loading')
);
export const selectRubrosError = createSelector(
  (state) => state.rubro?.error,
  (e) => (e === null || e === undefined ? null : String(e))
);

export default rubroSlice.reducer;
