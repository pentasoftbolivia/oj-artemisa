import { supabase } from "./supabase";

export const loginUserWithEmailPassword = async ({ email, password }) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { ok: false, errorMessage: error.message };
    }

    const { user } = data;

    return {
      ok: true,
      uid: user.id,
      email: user.email,
      photoURL: user.user_metadata?.avatar_url || null,
      name: user.user_metadata?.full_name || user.email,
      role: user.user_metadata?.role || null,
    };
  } catch (error) {
    return { ok: false, errorMessage: error.message };
  }
};

export const loginWithGoogle = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });

    if (error) {
      return {
        ok: false,
        errorMessage: error.message,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error.message,
    };
  }
};
