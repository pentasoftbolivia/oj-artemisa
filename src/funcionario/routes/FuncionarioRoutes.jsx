import { Routes, Route } from "react-router-dom";
import FuncionarioApp from "../FuncionarioApp";

export const FuncionarioRoutes = () => {
  return (
    <div className="container mt-2">
      <Routes>
        <Route index element={<FuncionarioApp />} />
        <Route path="*" element={<FuncionarioApp />} />
      </Routes>
    </div>
  );
};

export default FuncionarioRoutes;
