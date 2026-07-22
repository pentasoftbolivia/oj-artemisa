import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchCiudades,
  addCiudad,
  updateCiudad,
  deleteCiudad
} from './ciudadThunks';

const ciudadSlice = createSlice({
  name: 'ciudad',
  initialState: { data: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCiudades.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchCiudades.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; state.error = null; })
      .addCase(fetchCiudades.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload || action.error.message; state.data = []; })
      .addCase(addCiudad.fulfilled, (state, action) => { state.data.push(action.payload); })
      .addCase(addCiudad.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(updateCiudad.fulfilled, (state, action) => { const i = state.data.findIndex(c => c.codigociudad === action.payload.codigociudad); if (i !== -1) state.data[i] = action.payload; })
      .addCase(updateCiudad.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(deleteCiudad.fulfilled, (state, action) => { state.data = state.data.filter(c => c.codigociudad !== action.payload); })
      .addCase(deleteCiudad.rejected, (state, action) => { state.error = action.payload || action.error.message; });
  },
});

export const selectCiudades = createSelector(
  (state) => state.ciudad?.data || [],
  (c) => (Array.isArray(c) ? c : [])
);
export const selectCiudadesLoading = createSelector(
  (state) => state.ciudad?.status,
  (s) => Boolean(s === 'loading')
);
export const selectCiudadesError = createSelector(
  (state) => state.ciudad?.error,
  (e) => (e === null || e === undefined ? null : String(e))
);

export default ciudadSlice.reducer;
