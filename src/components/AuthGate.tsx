import type { ReactNode } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient";
import { signOut, useAuth } from "../lib/auth";
import { afgoerTidAdgang, useTidAdgang } from "../lib/tidAdgang";
import Login from "./Login";

const HUB_URL = "https://smu.signmeup.dk";

// Lukker appen bag login + app-adgang NÅR Supabase er konfigureret (deployet).
// Login alene er ikke nok: brugeren skal have `tid`-adgang i Hub (app_adgange).
// Lokal dev uden keys forbliver åben (local fallback).
export default function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const svar = useTidAdgang(getSupabaseClient(), session?.user.id ?? null);
  const tilstand = afgoerTidAdgang({
    supabaseConfigured: isSupabaseConfigured,
    authLoading: loading,
    harSession: Boolean(session),
    svar,
  });

  switch (tilstand) {
    case "aaben":
    case "adgang":
      return <>{children}</>;
    case "login":
      return <Login />;
    case "indlaeser":
      return (
        <div className="login">
          <div className="login-card">
            <p className="login-sub">Indlæser…</p>
          </div>
        </div>
      );
    default:
      return <IngenAdgang tilstand={tilstand} />;
  }
}

function IngenAdgang({ tilstand }: { tilstand: "ingen_adgang" | "fejl" }) {
  const besked =
    tilstand === "fejl"
      ? "Din adgang kunne ikke bekræftes lige nu. Prøv igen om et øjeblik."
      : "Du er logget ind, men din bruger har ikke adgang til SMU Tid. Adgang tildeles i SMU Hub under Medarbejdere.";
  const knap = { display: "block", textAlign: "center", textDecoration: "none" } as const;

  return (
    <div className="login">
      <div className="login-card">
        <span className="login-brand">SMU Platform</span>
        <h1 className="login-title">SMU Tid</h1>
        <p className="login-sub">{besked}</p>

        {tilstand === "fejl" ? (
          <button className="smu-btn-primary" onClick={() => window.location.reload()}>
            Prøv igen
          </button>
        ) : (
          <a className="smu-btn-primary" href={HUB_URL} style={knap}>
            Gå til SMU Hub
          </a>
        )}

        <button
          className="smu-btn-secondary"
          onClick={() => void signOut()}
          style={{ width: "100%", marginTop: 8, padding: 11 }}
        >
          Log ud
        </button>
      </div>
    </div>
  );
}
