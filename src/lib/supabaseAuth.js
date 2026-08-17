import { supabase } from "./supabase";

export const getRoleForUser = async (uid) => {
  try {
    const { data: roleData } = await supabase
      .from("rol")
      .select("rol")
      .eq("UID", uid)
      .maybeSingle();

    return roleData?.rol || "Usuario";
  } catch {
    return "Usuario";
  }
};

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

    // Verificar si el usuario es administrador en la tabla "rol"
    const role = await getRoleForUser(user.id);

    return {
      ok: true,
      uid: user.id,
      email: user.email,
      photoURL: user.user_metadata?.avatar_url || null,
      name: user.user_metadata?.full_name || user.email,
      role: role,
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
