import { Routes, Route } from "react-router-dom";
import ReportesApp from "../ReportesApp";

export const ReportesRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<ReportesApp />} />
      <Route path="*" element={<ReportesApp />} />
    </Routes>
  </div>
);

export default ReportesRoutes;
