import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";

import { supabase } from "@/lib/supabase";
import {
  activosfijos,
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
        const userInfo = {
          uid: session.user.id,
          email: session.user.email,
          displayName:
            session.user.user_metadata?.full_name || session.user.email,
          photoURL: session.user.user_metadata?.avatar_url,
          role: session.user.user_metadata?.role || null,
        };

        localStorage.setItem("user", JSON.stringify(userInfo));
        dispatch(activosfijos(userInfo));
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
