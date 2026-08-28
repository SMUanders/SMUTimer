const HUB_URL = "https://smu.signmeup.dk";

/**
 * SMU Tid har ikke længere sit eget login.
 *
 * SMU Platform har ét fælles login på SMU Hub. Denne side tilbød tidligere
 * email + adgangskode direkte, hvilket var en parallel loginvej: en medarbejder
 * kunne blive på det fælles password og aldrig komme over på sit personlige.
 *
 * Supabase Auth er uændret identitetsejer. Der er ikke tilføjet ny auth; der er
 * kun fjernet en parallel indgang. Sessionen deles via platform-cookien på
 * `.smu.signmeup.dk`, så login i Hub åbner SMU Tid uden nyt login.
 *
 * Adgangskontrollen er uændret: `app_adgange`, `app_roller` og RLS afgør fortsat
 * alt. Et Hub-login giver ikke i sig selv adgang til SMU Tid.
 */
export default function Login() {
  return (
    <div className="login">
      <div className="login-card">
        <span className="login-brand">SMU Platform</span>
        <h1 className="login-title">SMU Tid</h1>
        <p className="login-sub">
          SMU Platform har ét fælles login. Log ind på SMU Hub med dit korte brugernavn og
          din personlige adgangskode — så åbner SMU Tid uden nyt login.
        </p>

        <a
          className="smu-btn-primary"
          href={HUB_URL}
          style={{ display: "block", textAlign: "center", textDecoration: "none" }}
        >
          Gå til SMU Hub
        </a>

        <p className="login-sub" style={{ marginTop: 16 }}>
          Mangler du adgangskode, så bed Anders om et engangslink.
        </p>
      </div>
    </div>
  );
}
