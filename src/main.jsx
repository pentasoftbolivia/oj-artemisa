import { StrictMode } from "react";
import ReactDOM from 'react-dom/client';

import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";

import App from './App';
import { ErrorBoundary } from './components/ui/error-boundary';
import './index.css';

window.addEventListener("error", (e) => {
  if (e.message?.includes("error loading dynamically imported module") || e.message?.includes("Importing a module script failed")) {
    e.preventDefault();
    window.location.reload();
  }
});

// Create root
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the app
root.render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={ store }>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);