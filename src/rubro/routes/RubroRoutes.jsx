import { Routes, Route } from "react-router-dom";
import RubroApp from "../RubroApp";

export const RubroRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<RubroApp />} />
      <Route path="*" element={<RubroApp />} />
    </Routes>
  </div>
);

export default RubroRoutes;
