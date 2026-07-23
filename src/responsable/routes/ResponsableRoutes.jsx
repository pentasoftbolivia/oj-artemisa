import { Routes, Route } from "react-router-dom";
import ResponsableApp from "../ResponsableApp";

export const ResponsableRoutes = () => {
  return (
    <div className="container mt-2">
      <Routes>
        <Route index element={<ResponsableApp />} />
        <Route path="*" element={<ResponsableApp />} />
      </Routes>
    </div>
  );
};

export default ResponsableRoutes;
