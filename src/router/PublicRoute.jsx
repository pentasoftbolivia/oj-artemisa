
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

import { selectIsAuthenticated, selectAuthStatus } from "@/store/auth/authSlice";

export const PublicRoute = ({ children }) => {

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authStatus = useSelector(selectAuthStatus);

  if (authStatus === 'checking') return null;

  return (
    !isAuthenticated
      ? children
      : <Navigate to="/" replace />
  )
}
