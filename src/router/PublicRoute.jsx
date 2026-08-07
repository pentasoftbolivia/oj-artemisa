
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

import { selectIsAuthenticated, selectAuthStatus } from "@/store/auth/authSlice";
import LoadingSpinner from "@/components/ui/loading-spinner";

export const PublicRoute = ({ children }) => {

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const authStatus = useSelector(selectAuthStatus);

  if (authStatus === 'checking') {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <LoadingSpinner containerHeight="80px" />
      </div>
    );
  }

  return (
    !isAuthenticated
      ? children
      : <Navigate to="/" replace />
  )
}
