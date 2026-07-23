import { Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import InicioPage from "@/inicio/pages/InicioPage";

import { PrivateRoute } from "./PrivateRoute";
import { PublicRoute } from "./PublicRoute";
import { useCheckAuth, useSupabaseRealtime } from "@/hooks";
import { Navbar } from "@/components/navbar/Navbar";
import LoadingSpinner from "@/components/ui/loading-spinner";
import lazyWithRetry from "@/lib/lazyWithRetry";

// Lazy loaded routes
const AuthRoutes = lazyWithRetry(() => import("@/auth/routes/AuthRoutes").then(m => ({ default: m.AuthRoutes })));
const FuncionarioRoutes = lazyWithRetry(() => import("@/funcionario/routes/FuncionarioRoutes").then(m => ({ default: m.FuncionarioRoutes })));
const AmbienteRoutes = lazyWithRetry(() => import("@/ambiente/routes/AmbienteRoutes").then(m => ({ default: m.AmbienteRoutes })));
const CiudadRoutes = lazyWithRetry(() => import("@/ciudad/routes/CiudadRoutes").then(m => ({ default: m.CiudadRoutes })));
const InmuebleRoutes = lazyWithRetry(() => import("@/inmueble/routes/InmuebleRoutes").then(m => ({ default: m.InmuebleRoutes })));
const NivelRoutes = lazyWithRetry(() => import("@/nivel/routes/NivelRoutes").then(m => ({ default: m.NivelRoutes })));
const RubroRoutes = lazyWithRetry(() => import("@/rubro/routes/RubroRoutes").then(m => ({ default: m.RubroRoutes })));
const TipoRubroRoutes = lazyWithRetry(() => import("@/tiporubro/routes/TipoRubroRoutes").then(m => ({ default: m.TipoRubroRoutes })));
const ActivosFijosRoutes = lazyWithRetry(() => import("@/activosFijos/routes/ActivosFijosRoutes").then(m => ({ default: m.ActivosFijosRoutes })));
const AsignacionesRoutes = lazyWithRetry(() => import("@/asignaciones/routes/AsignacionesRoutes").then(m => ({ default: m.AsignacionesRoutes })));
const MovimientosRoutes = lazyWithRetry(() => import("@/movimientos/routes/MovimientosRoutes").then(m => ({ default: m.MovimientosRoutes })));

export const AppRouter = () => {
  useCheckAuth();
  useSupabaseRealtime();
  const location = useLocation();

  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center"><LoadingSpinner /></div>}>
      <Routes>
        <Route
          path="/auth/*"
          element={
            <PublicRoute>
              <AuthRoutes />
            </PublicRoute>
          }
        />

        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Navbar />
              {location.pathname === "/" && <InicioPage />}
            </PrivateRoute>
          }
        />

        <Route
          path="/funcionario/*"
          element={
            <PrivateRoute>
              <Navbar />
              <FuncionarioRoutes />
            </PrivateRoute>
          }
        />

        <Route
          path="/ambientes/*"
          element={
            <PrivateRoute>
              <Navbar />
              <AmbienteRoutes />
            </PrivateRoute>
          }
        />

        <Route
          path="/ciudades/*"
          element={
            <PrivateRoute>
              <Navbar />
              <CiudadRoutes />
            </PrivateRoute>
          }
        />

        <Route
          path="/inmuebles/*"
          element={
            <PrivateRoute>
              <Navbar />
              <InmuebleRoutes />
            </PrivateRoute>
          }
        />

        <Route
          path="/niveles/*"
          element={
            <PrivateRoute>
              <Navbar />
              <NivelRoutes />
            </PrivateRoute>
          }
        />

        <Route
          path="/rubros/*"
          element={
            <PrivateRoute>
              <Navbar />
              <RubroRoutes />
            </PrivateRoute>
          }
        />

        <Route
          path="/tiporubro/*"
          element={
            <PrivateRoute>
              <Navbar />
              <TipoRubroRoutes />
            </PrivateRoute>
          }
        />

        <Route
          path="/activos/*"
          element={
            <PrivateRoute>
              <Navbar />
              <ActivosFijosRoutes />
            </PrivateRoute>
          }
        />

        <Route
          path="/asignaciones/*"
          element={
            <PrivateRoute>
              <Navbar />
              <AsignacionesRoutes />
            </PrivateRoute>
          }
        />

        <Route
          path="/movimientos/*"
          element={
            <PrivateRoute>
              <Navbar />
              <MovimientosRoutes />
            </PrivateRoute>
          }
        />

      </Routes>
    </Suspense>
  );
};

export default AppRouter;
