import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchAmbientes,
  addAmbiente,
  updateAmbiente,
  deleteAmbiente
} from './ambienteThunks';

const ambienteSlice = createSlice({
  name: 'ambiente',
  initialState: { data: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAmbientes.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(fetchAmbientes.fulfilled, (state, action) => { state.status = 'succeeded'; state.data = action.payload; state.error = null; })
      .addCase(fetchAmbientes.rejected, (state, action) => { state.status = 'failed'; state.error = action.payload || action.error.message; state.data = []; })
      .addCase(addAmbiente.fulfilled, (state, action) => { state.data.push(action.payload); })
      .addCase(addAmbiente.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(updateAmbiente.fulfilled, (state, action) => { const i = state.data.findIndex(a => a.codigoambiente === action.payload.codigoambiente); if (i !== -1) state.data[i] = action.payload; })
      .addCase(updateAmbiente.rejected, (state, action) => { state.error = action.payload || action.error.message; })
      .addCase(deleteAmbiente.fulfilled, (state, action) => { state.data = state.data.filter(a => a.codigoambiente !== action.payload); })
      .addCase(deleteAmbiente.rejected, (state, action) => { state.error = action.payload || action.error.message; });
  },
});

export const selectAmbientes = createSelector(
  (state) => state.ambiente?.data || [],
  (a) => (Array.isArray(a) ? a : [])
);
export const selectAmbientesLoading = createSelector(
  (state) => state.ambiente?.status,
  (s) => Boolean(s === 'loading')
);
export const selectAmbientesError = createSelector(
  (state) => state.ambiente?.error,
  (e) => (e === null || e === undefined ? null : String(e))
);

export default ambienteSlice.reducer;
