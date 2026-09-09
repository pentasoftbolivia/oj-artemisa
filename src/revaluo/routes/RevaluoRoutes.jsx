import { Routes, Route } from "react-router-dom";
import RevaluoApp from "../RevaluoApp";

export const RevaluoRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<RevaluoApp />} />
      <Route path="*" element={<RevaluoApp />} />
    </Routes>
  </div>
);

export default RevaluoRoutes;
