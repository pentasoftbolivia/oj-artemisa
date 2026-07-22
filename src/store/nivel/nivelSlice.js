import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchNiveles,
  addNivel,
  updateNivel,
  deleteNivel
} from './nivelThunks';

const nivelSlice = createSlice({
  name: 'nivel',
  initialState: { data: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNiveles.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchNiveles.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; state.error = null; })
      .addCase(fetchNiveles.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload || action.error.message; state.data = []; })
      .addCase(addNivel.fulfilled, (state, action) => { state.data.push(action.payload); })
      .addCase(addNivel.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(updateNivel.fulfilled, (state, action) => { const i = state.data.findIndex(a => a.codigonivel === action.payload.codigonivel); if (i !== -1) state.data[i] = action.payload; })
      .addCase(updateNivel.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(deleteNivel.fulfilled, (state, action) => { state.data = state.data.filter(a => a.codigonivel !== action.payload); })
      .addCase(deleteNivel.rejected, (state, action) => { state.error = action.payload || action.error.message; });
  },
});

export const selectNiveles = createSelector(
  (state) => state.nivel?.data || [],
  (a) => (Array.isArray(a) ? a : [])
);
export const selectNivelesLoading = createSelector(
  (state) => state.nivel?.status,
  (s) => Boolean(s === 'loading')
);
export const selectNivelesError = createSelector(
  (state) => state.nivel?.error,
  (e) => (e === null || e === undefined ? null : String(e))
);

export default nivelSlice.reducer;
