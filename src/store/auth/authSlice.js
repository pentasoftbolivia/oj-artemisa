import { createSlice } from "@reduxjs/toolkit";

export const authSlice = createSlice({
  name: "auth",
  initialState: {
    status: "checking",
    uid: null,
    email: null,
    displayName: null,
    photoURL: null,
    role: null,
    errorMessage: null,
  },
  reducers: {
    activosfijos: (state, action) => {
      state.status = "authenticated";
      state.uid = action.payload.uid;
      state.email = action.payload.email;
      state.displayName = action.payload.displayName;
      state.photoURL = action.payload.photoURL;
      state.role = action.payload.role || null;
      state.errorMessage = null;
    },
    logout: (state, { payload }) => {
      state.status = "not-authenticated";
      state.uid = null;
      state.email = null;
      state.displayName = null;
      state.photoURL = null;
      state.role = null;
      state.errorMessage = payload?.errorMessage || null;
    },
    checkingCredentials: (state) => {
      state.status = "checking";
    },
  },
});

export const { activosfijos, logout, checkingCredentials } = authSlice.actions;

export default authSlice.reducer;

export const selectUser = (state) => state.auth;
export const selectUserRole = (state) => state.auth.role;
export const selectIsAuthenticated = (state) =>
  state.auth.status === "authenticated";
export const selectAuthStatus = (state) => state.auth.status;
