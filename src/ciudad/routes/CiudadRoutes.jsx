import { Routes, Route } from "react-router-dom";
import CiudadApp from "../CiudadApp";

export const CiudadRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<CiudadApp />} />
      <Route path="*" element={<CiudadApp />} />
    </Routes>
  </div>
);

export default CiudadRoutes;
