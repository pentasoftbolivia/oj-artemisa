import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";

import {
  selectIsAuthenticated,
  selectAuthStatus,
} from "@/store/auth/authSlice";

export const PrivateRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authStatus = useSelector(selectAuthStatus);

  const { pathname, search } = useLocation();

  const lastPath = `${pathname}${search}`;

  useEffect(() => {
    localStorage.setItem("lastPath", lastPath);
  }, [lastPath]);

  if (authStatus === "checking") return null;

  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/auth/activosfijos" replace />
  );
};
