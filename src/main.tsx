import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import EmployeeApp from "./components/EmployeeApp";
import Admin from "./components/Admin";
import AuthGate from "./components/AuthGate";
import "./index.css";

// Sti-baseret routing (Vite serverer index.html som SPA-fallback):
//  - /oversigt (eller /admin)             → Admin/Overblik (uændret)
//  - ?medarbejder=… (deep-link fra admin) → gammel dagsseddel (App) = leder-detalje/korrektion
//  - ellers                               → medarbejderflow vNext (EmployeeApp)
const isAdmin = /^\/(oversigt|admin)\/?$/.test(window.location.pathname);
const isLeaderDetail = new URLSearchParams(window.location.search).has("medarbejder");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>{isAdmin ? <Admin /> : isLeaderDetail ? <App /> : <EmployeeApp />}</AuthGate>
  </React.StrictMode>
);
