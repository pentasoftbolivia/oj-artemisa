import { Routes, Route } from "react-router-dom";
import AsignacionesApp from "../AsignacionesApp";

export const AsignacionesRoutes = () => {
  return (
    <div className="container mt-2">
      <Routes>
        <Route index element={<AsignacionesApp />} />
        <Route path="*" element={<AsignacionesApp />} />
      </Routes>
    </div>
  );
};

export default AsignacionesRoutes;
