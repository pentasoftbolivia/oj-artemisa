import { Routes, Route } from "react-router-dom";
import InmuebleApp from "../InmuebleApp";

export const InmuebleRoutes = () => (
  <div className="container mt-2">
    <Routes>
      <Route index element={<InmuebleApp />} />
      <Route path="*" element={<InmuebleApp />} />
    </Routes>
  </div>
);

export default InmuebleRoutes;
