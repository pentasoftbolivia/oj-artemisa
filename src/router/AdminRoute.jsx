import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUserRole } from "@/store/auth/authSlice";

export const AdminRoute = ({ children }) => {
  const role = useSelector(selectUserRole);
  const isAdmin = role === "Administrador";

  return isAdmin ? children : <Navigate to="/inventario" replace />;
};
