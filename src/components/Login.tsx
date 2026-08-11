import { useState } from "react";
import { signIn } from "../lib/auth";

// Login-side (email/password via Supabase Auth). Ingen selvregistrering:
// beta-brugere oprettes i Supabase (Auth → Users → Add user).
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // Ved succes opdaterer onAuthStateChange appen automatisk.
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /invalid login credentials/i.test(msg)
          ? "Forkert email eller adgangskode."
          : msg
      );
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <span className="login-brand">SMU OS</span>
        <h1 className="login-title">SMU Tid</h1>
        <p className="login-sub">Log ind for at fortsætte</p>

        {error && <div className="msg error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Adgangskode</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Logger ind…" : "Log ind"}
        </button>
      </form>
    </div>
  );
}
