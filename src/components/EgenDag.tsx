import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient";
import { canRegisterOwnTime, useTidRole } from "../lib/tidRole";
import EmployeeApp from "./EmployeeApp";

// Egen dagsseddel. En observatør har læseadgang (read-only) og kan ikke registrere
// tid — RLS afviser det — så i stedet for en dagsseddel, hvor gem fejler, vises en
// tydelig besked med vej til Overblik, som er read-only.
export default function EgenDag() {
  const { role, loading } = useTidRole(getSupabaseClient(), isSupabaseConfigured);

  if (loading) {
    return (
      <div className="login">
        <div className="login-card">
          <p className="login-sub">Indlæser…</p>
        </div>
      </div>
    );
  }
  if (canRegisterOwnTime(role)) return <EmployeeApp />;

  return (
    <div className="login">
      <div className="login-card">
        <span className="login-brand">SMU Platform</span>
        <h1 className="login-title">SMU Tid</h1>
        <p className="login-sub">
          Du har læseadgang i SMU Tid. Du kan se overblikket, men ikke registrere tid.
          Skal du kunne det, tildeles rollen i SMU Hub under Medarbejdere.
        </p>
        <a className="smu-btn-primary" href="/oversigt" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          Gå til Overblik
        </a>
      </div>
    </div>
  );
}
