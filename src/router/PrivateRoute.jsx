import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";

import {
  selectIsAuthenticated,
  selectAuthStatus,
} from "@/store/auth/authSlice";
import LoadingSpinner from "@/components/ui/loading-spinner";

export const PrivateRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authStatus = useSelector(selectAuthStatus);

  const { pathname, search } = useLocation();

  const lastPath = `${pathname}${search}`;

  useEffect(() => {
    localStorage.setItem("lastPath", lastPath);
  }, [lastPath]);

  if (authStatus === "checking") {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <LoadingSpinner containerHeight="80px" />
      </div>
    );
  }

  return isAuthenticated ? (
    children
  ) : (
    <Navigate to="/auth/activosfijos" replace />
  );
};
