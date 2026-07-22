import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/auth/pages";
import { AuthCallback } from "../pages/AuthCallback";

export const AuthRoutes = () => {
  return (
    <Routes>
      <Route path="activosfijos" element={<LoginPage />} />
      <Route path="callback" element={<AuthCallback />} />

      <Route path="/*" element={<Navigate to="/auth/activosfijos" />} />
    </Routes>
  );
};

export default AuthRoutes;
