import AppRouter from "./router/AppRouter";
import { Toaster } from "./components/ui/toaster";

function App() {
  return (
    <>
      <AppRouter />
      <Toaster />
    </>
  );
}

export default App;
