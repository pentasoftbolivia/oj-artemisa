import { Routes, Route, Navigate } from "react-router-dom";
import MovimientosApp from "../MovimientosApp";

export const MovimientosRoutes = () => {
  return (
    <div className="container mt-2">
      <Routes>
        <Route index element={<MovimientosApp />} />
        <Route path="*" element={<Navigate to="/movimientos" />} />
      </Routes>
    </div>
  );
};

export default MovimientosRoutes;
