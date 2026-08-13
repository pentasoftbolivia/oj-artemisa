import { Routes, Route } from "react-router-dom";
import ConfigTransferenciaApp from "../ConfigTransferenciaApp";

export const ConfigTransferenciaRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<ConfigTransferenciaApp />} />
      <Route path="*" element={<ConfigTransferenciaApp />} />
    </Routes>
  </div>
);

export default ConfigTransferenciaRoutes;