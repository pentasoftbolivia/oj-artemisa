import { Routes, Route } from "react-router-dom";
import AmbienteApp from "../AmbienteApp";

export const AmbienteRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<AmbienteApp />} />
      <Route path="*" element={<AmbienteApp />} />
    </Routes>
  </div>
);

export default AmbienteRoutes;
