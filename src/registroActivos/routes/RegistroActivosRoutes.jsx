import { Routes, Route } from "react-router-dom";
import RegistroActivosApp from "../RegistroActivosApp";

export const RegistroActivosRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<RegistroActivosApp />} />
      <Route path="*" element={<RegistroActivosApp />} />
    </Routes>
  </div>
);

export default RegistroActivosRoutes;
