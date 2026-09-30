import { Routes, Route } from "react-router-dom";
import ConsultaRevaluoApp from "../ConsultaRevaluoApp";

export const ConsultaRevaluoRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<ConsultaRevaluoApp />} />
      <Route path="*" element={<ConsultaRevaluoApp />} />
    </Routes>
  </div>
);

export default ConsultaRevaluoRoutes;
