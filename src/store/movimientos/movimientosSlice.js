import { createSlice } from '@reduxjs/toolkit';
import { fetchMovimientos } from './movimientosThunks';

const movimientosSlice = createSlice({
  name: 'movimientos',
  initialState: {
    data: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMovimientos.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchMovimientos.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
        state.error = null;
      })
      .addCase(fetchMovimientos.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
        state.data = [];
      });
  },
});

export default movimientosSlice.reducer;