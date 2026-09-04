import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getRoleForUser } from "@/lib/supabaseAuth";

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

      const role = await getRoleForUser(session.user.id);
      if (role === "Inventariador") {
        localStorage.setItem("lastPath", "/inventario");
        navigate("/inventario", { replace: true });
      } else {
        const lastPath = localStorage.getItem("lastPath") || "/inicio";
        const targetPath = (lastPath === "/auth" || lastPath.startsWith("/auth/")) ? "/inicio" : lastPath;
        navigate(targetPath, { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Completando inicio de sesión...</p>
    </div>
  );
};
