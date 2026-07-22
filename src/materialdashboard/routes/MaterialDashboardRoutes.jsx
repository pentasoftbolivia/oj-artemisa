import { Routes, Route } from "react-router-dom";
import MaterialDashboardApp from "../MaterialDashboardApp";

export const MaterialDashboardRoutes = () => {
  return (
    <div className="container mt-2">
      <Routes>
        <Route index element={<MaterialDashboardApp />} />
        <Route path="*" element={<MaterialDashboardApp />} />
      </Routes>
    </div>
  );
};

export default MaterialDashboardRoutes;
