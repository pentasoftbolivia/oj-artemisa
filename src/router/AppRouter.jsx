import { Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import InicioPage from "@/inicio/pages/InicioPage";

import { PrivateRoute } from "./PrivateRoute";
import { PublicRoute } from "./PublicRoute";
import { AdminRoute } from "./AdminRoute";
import { useCheckAuth, useSupabaseRealtime } from "@/hooks";
import { Navbar } from "@/components/navbar/Navbar";
import LoadingSpinner from "@/components/ui/loading-spinner";
import lazyWithRetry from "@/lib/lazyWithRetry";

// Lazy loaded routes
const AuthRoutes = lazyWithRetry(() => import("@/auth/routes/AuthRoutes").then(m => ({ default: m.AuthRoutes })));
const AmbienteRoutes = lazyWithRetry(() => import("@/ambiente/routes/AmbienteRoutes").then(m => ({ default: m.AmbienteRoutes })));
const CiudadRoutes = lazyWithRetry(() => import("@/ciudad/routes/CiudadRoutes").then(m => ({ default: m.CiudadRoutes })));
const InmuebleRoutes = lazyWithRetry(() => import("@/inmueble/routes/InmuebleRoutes").then(m => ({ default: m.InmuebleRoutes })));
const NivelRoutes = lazyWithRetry(() => import("@/nivel/routes/NivelRoutes").then(m => ({ default: m.NivelRoutes })));
const RubroRoutes = lazyWithRetry(() => import("@/rubro/routes/RubroRoutes").then(m => ({ default: m.RubroRoutes })));
const TipoRubroRoutes = lazyWithRetry(() => import("@/tiporubro/routes/TipoRubroRoutes").then(m => ({ default: m.TipoRubroRoutes })));
const ActivosFijosRoutes = lazyWithRetry(() => import("@/activosFijos/routes/ActivosFijosRoutes").then(m => ({ default: m.ActivosFijosRoutes })));
const AsignacionesRoutes = lazyWithRetry(() => import("@/asignaciones/routes/AsignacionesRoutes").then(m => ({ default: m.AsignacionesRoutes })));

const ResponsableRoutes = lazyWithRetry(() => import("@/responsable/routes/ResponsableRoutes").then(m => ({ default: m.ResponsableRoutes })));
const ConfigResponsableRoutes = lazyWithRetry(() => import("@/configResponsable/routes/ConfigResponsableRoutes").then(m => ({ default: m.ConfigResponsableRoutes })));
const ConfigTransferenciaRoutes = lazyWithRetry(() => import("@/configTransferencias/routes/ConfigTransferenciaRoutes").then(m => ({ default: m.ConfigTransferenciaRoutes })));
const RegistroActivosRoutes = lazyWithRetry(() => import("@/registroActivos/routes/RegistroActivosRoutes").then(m => ({ default: m.RegistroActivosRoutes })));
const InventarioRoutes = lazyWithRetry(() => import("@/inventario/routes/InventarioRoutes").then(m => ({ default: m.InventarioRoutes })));

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
          path="/ambientes/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <AmbienteRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/ciudades/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <CiudadRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/inmuebles/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <InmuebleRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/niveles/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <NivelRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/rubros/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <RubroRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/tiporubro/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <TipoRubroRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/activos/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <ActivosFijosRoutes />
              </AdminRoute>
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
          path="/responsables/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <ResponsableRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/responsables-config/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <ConfigResponsableRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/actualizacion-transferencias/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <ConfigTransferenciaRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/registro-activos/*"
          element={
            <PrivateRoute>
              <AdminRoute>
                <Navbar />
                <RegistroActivosRoutes />
              </AdminRoute>
            </PrivateRoute>
          }
        />

        <Route
          path="/inventario/*"
          element={
            <PrivateRoute>
              <Navbar />
              <InventarioRoutes />
            </PrivateRoute>
          }
        />

      </Routes>
    </Suspense>
  );
};

export default AppRouter;
