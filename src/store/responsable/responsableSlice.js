import { createSlice, createSelector } from '@reduxjs/toolkit';
import {
  fetchResponsable,
  addResponsable,
  updateResponsable,
  deleteResponsable
} from './responsableThunks';

const responsableSlice = createSlice({
  name: 'responsable',
  initialState: {
    data: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchResponsable.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchResponsable.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
        state.error = null;
      })
      .addCase(fetchResponsable.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
        state.data = [];
      })
      .addCase(addResponsable.fulfilled, (state, action) => {
        state.data.push(action.payload);
      })
      .addCase(addResponsable.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(updateResponsable.fulfilled, (state, action) => {
        const index = state.data.findIndex(r => r.cirun === action.payload.cirun);
        if (index !== -1) {
          state.data[index] = action.payload;
        }
      })
      .addCase(updateResponsable.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      })
      .addCase(deleteResponsable.fulfilled, (state, action) => {
        state.data = state.data.filter(r => r.cirun !== action.payload);
      })
      .addCase(deleteResponsable.rejected, (state, action) => {
        state.error = action.payload || action.error.message;
      });
  },
});

export const selectSortedResponsable = createSelector(
  (state) => state.responsable?.data || [],
  (responsables) => {
    if (!Array.isArray(responsables)) return [];
    return [...responsables].sort((a, b) => {
      const pA = (a.paterno || "").trim().toLowerCase();
      const pB = (b.paterno || "").trim().toLowerCase();
      if (pA !== pB) return pA.localeCompare(pB);

      const mA = (a.materno || "").trim().toLowerCase();
      const mB = (b.materno || "").trim().toLowerCase();
      if (mA !== mB) return mA.localeCompare(mB);

      const n1A = (a.nombre1 || "").trim().toLowerCase();
      const n1B = (b.nombre1 || "").trim().toLowerCase();
      if (n1A !== n1B) return n1A.localeCompare(n1B);

      const n2A = (a.nombre2 || "").trim().toLowerCase();
      const n2B = (b.nombre2 || "").trim().toLowerCase();
      return n2A.localeCompare(n2B);
    });
  }
);

export const selectResponsableLoading = createSelector(
  (state) => state.responsable?.status,
  (status) => Boolean(status === 'loading')
);

export const selectResponsableError = createSelector(
  (state) => state.responsable?.error,
  (error) => (error === null || error === undefined ? null : String(error))
);

export const selectResponsable = createSelector(
  (state) => state.responsable?.data || [],
  (responsables) => (Array.isArray(responsables) ? [...responsables] : [])
);

export const selectResponsableByCirun = createSelector(
  (state) => state.responsable?.data,
  (state, cirun) => cirun,
  (responsables, cirun) => {
    if (!Array.isArray(responsables)) return undefined;
    return responsables.find(r => r.cirun === cirun);
  }
);

export default responsableSlice.reducer;
