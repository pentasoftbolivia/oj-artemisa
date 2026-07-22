import { Routes, Route } from "react-router-dom";
import TipoRubroApp from "../TipoRubroApp";

export const TipoRubroRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<TipoRubroApp />} />
      <Route path="*" element={<TipoRubroApp />} />
    </Routes>
  </div>
);

export default TipoRubroRoutes;
