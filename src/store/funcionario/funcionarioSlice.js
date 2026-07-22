import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchFuncionario,
  addFuncionario,
  updateFuncionario,
  deleteFuncionario
} from './funcionarioThunks';

const funcionarioSlice = createSlice({
  name: 'funcionario',
  initialState: {
    data: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFuncionario.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchFuncionario.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
        state.error = null;
      })
      .addCase(fetchFuncionario.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
        state.data = [];
      })
      .addCase(addFuncionario.fulfilled, (state, action) => {
        state.data.push(action.payload);
      })
      .addCase(addFuncionario.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(updateFuncionario.fulfilled, (state, action) => {
        const index = state.data.findIndex(f => f.cirun === action.payload.cirun);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(updateFuncionario.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteFuncionario.fulfilled, (state, action) => {
        state.data = state.data.filter(f => f.cirun !== action.payload);
      })
      .addCase(deleteFuncionario.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      });
  },
});

export const selectSortedFuncionario = createSelector(
  (state) => state.funcionario?.data || [],
  (funcionarios) => {
    if (!Array.isArray(funcionarios)) return [];
    return [...funcionarios].sort((a, b) => (a.cirun || "").localeCompare(b.cirun || ""));
  }
);

export const selectFuncionarioLoading = createSelector(
  (state) => state.funcionario?.status,
  (status) => Boolean(status === 'loading')
);

export const selectFuncionarioError = createSelector(
  (state) => state.funcionario?.error,
  (error) => (error === null || error === undefined ? null : String(error))
);

export const selectFuncionario = createSelector(
  (state) => state.funcionario?.data || [],
  (funcionarios) => (Array.isArray(funcionarios) ? [...funcionarios] : [])
);

export const selectFuncionarioByCirun = createSelector(
  (state) => state.funcionario?.data,
  (state, cirun) => cirun,
  (funcionarios, cirun) => {
    if (!Array.isArray(funcionarios)) return undefined;
    return funcionarios.find(f => f.cirun === cirun);
  }
);

export default funcionarioSlice.reducer;
