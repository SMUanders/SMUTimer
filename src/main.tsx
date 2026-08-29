import React from "react";
import ReactDOM from "react-dom/client";
import LeaderDay from "./components/LeaderDay";
import EmployeeApp from "./components/EmployeeApp";
import Admin from "./components/Admin";
import AuthGate from "./components/AuthGate";
import "./index.css";

// Sti-baseret routing (Vite serverer index.html som SPA-fallback):
//  - /oversigt (eller /admin)             → Admin/Overblik
//  - ?medarbejder=… (deep-link fra Overblik) → LeaderDay = leder-visning af medarbejderens
//    v2-dag ("Andreas' dag") med eksplicitte, rolle-gatede korrektioner (ikke "registrér som")
//  - ellers                               → medarbejderens egen v2-dag (EmployeeApp)
const isAdmin = /^\/(oversigt|admin)\/?$/.test(window.location.pathname);
const isLeaderDetail = new URLSearchParams(window.location.search).has("medarbejder");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>{isAdmin ? <Admin /> : isLeaderDetail ? <LeaderDay /> : <EmployeeApp />}</AuthGate>
  </React.StrictMode>
);
