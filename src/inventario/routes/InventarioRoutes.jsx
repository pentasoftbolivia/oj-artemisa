import { Routes, Route } from "react-router-dom";
import InventarioApp from "../InventarioApp";

export const InventarioRoutes = () => {
  return (
    <div className="container mt-2">
      <Routes>
        <Route index element={<InventarioApp />} />
        <Route path="*" element={<InventarioApp />} />
      </Routes>
    </div>
  );
};

export default InventarioRoutes;
