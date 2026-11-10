import React from "react";
import ReactDOM from "react-dom/client";
import LeaderDay from "./components/LeaderDay";
import EgenDag from "./components/EgenDag";
import Admin from "./components/Admin";
import AuthGate from "./components/AuthGate";
import Hjaelp from "./components/Hjaelp";
import "./index.css";

// Sti-baseret routing (Vite serverer index.html som SPA-fallback):
//  - /oversigt (eller /admin)             → Admin/Overblik
//  - /hjaelp                              → kort manual med skærmbilleder (Hjaelp)
//  - ?medarbejder=… (deep-link fra Overblik) → LeaderDay = leder-visning af medarbejderens
//    v2-dag ("Andreas' dag") med eksplicitte, rolle-gatede korrektioner (ikke "registrér som")
//  - ellers                               → medarbejderens egen v2-dag (EmployeeApp via EgenDag;
//                                           observatør får en read-only-besked i stedet)
const isAdmin = /^\/(oversigt|admin)\/?$/.test(window.location.pathname);
const isHjaelp = /^\/hjaelp\/?$/.test(window.location.pathname);
const isLeaderDetail = new URLSearchParams(window.location.search).has("medarbejder");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>{isHjaelp ? <Hjaelp /> : isAdmin ? <Admin /> : isLeaderDetail ? <LeaderDay /> : <EgenDag />}</AuthGate>
  </React.StrictMode>
);
