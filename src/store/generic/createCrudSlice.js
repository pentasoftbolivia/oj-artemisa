import { createSlice, createSelector } from "@reduxjs/toolkit";

export const createCrudSlice = ({ name, idColumn, thunks }) => {
  const { fetchAll, add, update, remove } = thunks;

  const slice = createSlice({
    name,
    initialState: { data: [], status: "idle", error: null },
    reducers: {},
    extraReducers: (builder) => {
      builder
        .addCase(fetchAll.pending, (state) => {
          state.status = "loading";
          state.error = null;
        })
        .addCase(fetchAll.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.data = action.payload;
          state.error = null;
        })
        .addCase(fetchAll.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.payload || action.error.message;
          state.data = [];
        })
        .addCase(add.fulfilled, (state, action) => {
          state.data.push(action.payload);
        })
        .addCase(add.rejected, (state, action) => {
          state.error = action.payload || action.error.message;
        })
        .addCase(update.fulfilled, (state, action) => {
          const index = state.data.findIndex((item) => item[idColumn] === action.payload[idColumn]);
          if (index !== -1) state.data[index] = action.payload;
        })
        .addCase(update.rejected, (state, action) => {
          state.error = action.payload || action.error.message;
        })
        .addCase(remove.fulfilled, (state, action) => {
          state.data = state.data.filter((item) => item[idColumn] !== action.payload);
        })
        .addCase(remove.rejected, (state, action) => {
          state.error = action.payload || action.error.message;
        });
    },
  });

  const selectData = createSelector(
    (state) => state[name]?.data || [],
    (data) => (Array.isArray(data) ? data : [])
  );

  const selectLoading = createSelector(
    (state) => state[name]?.status,
    (status) => Boolean(status === "loading")
  );

  const selectError = createSelector(
    (state) => state[name]?.error,
    (error) => (error === null || error === undefined ? null : String(error))
  );

  return {
    reducer: slice.reducer,
    selectors: { selectData, selectLoading, selectError },
  };
};
