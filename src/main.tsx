import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Admin from "./components/Admin";
import AuthGate from "./components/AuthGate";
import "./styles.css";

// Enkel sti-baseret routing (Vite serverer index.html som SPA-fallback):
//  /oversigt (eller /admin) → Admin/Overblik, ellers dagsseddel.
const isAdmin = /^\/(oversigt|admin)\/?$/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>{isAdmin ? <Admin /> : <App />}</AuthGate>
  </React.StrictMode>
);
