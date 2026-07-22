import { Routes, Route } from "react-router-dom";
import NivelApp from "../NivelApp";

export const NivelRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<NivelApp />} />
      <Route path="*" element={<NivelApp />} />
    </Routes>
  </div>
);

export default NivelRoutes;
