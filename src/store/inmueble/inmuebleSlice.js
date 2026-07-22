import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchInmuebles,
  addInmueble,
  updateInmueble,
  deleteInmueble
} from './inmuebleThunks';

const inmuebleSlice = createSlice({
  name: 'inmueble',
  initialState: { data: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInmuebles.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchInmuebles.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; state.error = null; })
      .addCase(fetchInmuebles.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload || action.error.message; state.data = []; })
      .addCase(addInmueble.fulfilled, (state, action) => { state.data.push(action.payload); })
      .addCase(addInmueble.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(updateInmueble.fulfilled, (state, action) => { const i = state.data.findIndex(a => a.codigoinmueble === action.payload.codigoinmueble); if (i !== -1) state.data[i] = action.payload; })
      .addCase(updateInmueble.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(deleteInmueble.fulfilled, (state, action) => { state.data = state.data.filter(a => a.codigoinmueble !== action.payload); })
      .addCase(deleteInmueble.rejected, (state, action) => { state.error = action.payload || action.error.message; });
  },
});

export const selectInmuebles = createSelector(
  (state) => state.inmueble?.data || [],
  (a) => (Array.isArray(a) ? a : [])
);
export const selectInmueblesLoading = createSelector(
  (state) => state.inmueble?.status,
  (s) => Boolean(s === 'loading')
);
export const selectInmueblesError = createSelector(
  (state) => state.inmueble?.error,
  (e) => (e === null || e === undefined ? null : String(e))
);

export default inmuebleSlice.reducer;
