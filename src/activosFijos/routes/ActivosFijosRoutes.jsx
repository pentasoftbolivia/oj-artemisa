import { Routes, Route } from "react-router-dom";
import ActivosFijosApp from "../ActivosFijosApp";

export const ActivosFijosRoutes = () => {
  return (
    <div className="container mt-2">
      <Routes>
        <Route index element={<ActivosFijosApp />} />
        <Route path="*" element={<ActivosFijosApp />} />
      </Routes>
    </div>
  );
};

export default ActivosFijosRoutes;
