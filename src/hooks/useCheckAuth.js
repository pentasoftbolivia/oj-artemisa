import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";

import { supabase } from "@/lib/supabase";
import { getRoleForUser } from "@/lib/supabaseAuth";
import {
  login,
  logout,
  checkingCredentials,
} from "@/store/auth/authSlice";

export const useCheckAuth = () => {
  const dispatch = useDispatch();
  const handled = useRef(false);

  useEffect(() => {
    const handleSession = async (session) => {
      dispatch(checkingCredentials());

      if (!session) {
        dispatch(logout());
        return;
      }

      try {
        const role = await getRoleForUser(session.user.id);

        const userInfo = {
          uid: session.user.id,
          email: session.user.email,
          displayName:
            session.user.user_metadata?.full_name || session.user.email,
          photoURL: session.user.user_metadata?.avatar_url,
          role: role,
        };

        localStorage.setItem("user", JSON.stringify(userInfo));
        dispatch(login(userInfo));
      } catch (error) {
        console.error("Error restoring auth session:", error);
        dispatch(logout({ errorMessage: error.message }));
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // SIGNED_OUT: always logout
      if (event === "SIGNED_OUT") {
        dispatch(logout());
        return;
      }

      // Only handle session on first INITIAL_SESSION or SIGNED_IN
      if (handled.current) return;
      handled.current = true;

      handleSession(session);
    });

    return () => {
      handled.current = false;
      subscription.unsubscribe();
    };
  }, [dispatch]);
};
