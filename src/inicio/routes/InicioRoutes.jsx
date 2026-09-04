import { Routes, Route } from "react-router-dom";
import InicioApp from "../InicioApp";

export const InicioRoutes = () => {
  return (
    <div className="container mt-2">
      <Routes>
        <Route index element={<InicioApp />} />
        <Route path="*" element={<InicioApp />} />
      </Routes>
    </div>
  );
};

export default InicioRoutes;
