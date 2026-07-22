import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        navigate("/auth/activosfijos", { replace: true });
        return;
      }

      const lastPath = localStorage.getItem("lastPath") || "/";
      navigate(lastPath, { replace: true });
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Completando inicio de sesión...</p>
    </div>
  );
};
