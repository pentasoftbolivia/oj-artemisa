import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUserRole } from "@/store/auth/authSlice";

export const AdminRoute = ({ children }) => {
  const role = useSelector(selectUserRole);
  const isAdmin = role !== "Usuario"; // Todos los que están en la tabla rol tienen un rol distinto a "Usuario"

  return isAdmin ? children : <Navigate to="/inventario" />;
};
