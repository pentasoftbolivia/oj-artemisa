import { Routes, Route } from "react-router-dom";
import ConfigResponsableApp from "../ConfigResponsableApp";

export const ConfigResponsableRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<ConfigResponsableApp />} />
      <Route path="*" element={<ConfigResponsableApp />} />
    </Routes>
  </div>
);

export default ConfigResponsableRoutes;