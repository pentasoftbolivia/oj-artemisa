import { checkingCredentials, activosfijos, logout } from "./authSlice";
import {
  loginUserWithEmailPassword,
  loginWithGoogle,
} from "@/lib/supabaseAuth";

export const startGoogleSignIn = () => {
  return async (dispatch) => {
    dispatch(checkingCredentials());
    const result = await loginWithGoogle();
    if (!result.ok) {
      dispatch(logout({ errorMessage: result.errorMessage }));
    }
  };
};

export const startLoginWithEmailPassword = ({ email, password }) => {
  return async (dispatch) => {
    dispatch(checkingCredentials());

    try {
      const result = await loginUserWithEmailPassword({ email, password });

      if (!result.ok) {
        dispatch(logout({ errorMessage: result.errorMessage }));
        return {
          ok: false,
          error: result.errorMessage,
        };
      }

      const userData = {
        displayName: result.name,
        email: result.email,
        photoURL: result.photoURL,
        role: result.role,
        uid: result.uid,
      };

      localStorage.setItem("user", JSON.stringify(userData));
      dispatch(activosfijos(userData));
      return {
        ok: true,
        ...userData,
      };
    } catch (error) {
      console.error("Error in startLoginWithEmailPassword:", error);
      const errorMessage = error.message || "Error al iniciar sesión";
      dispatch(logout({ errorMessage }));
      return {
        ok: false,
        error: errorMessage,
      };
    }
  };
};
