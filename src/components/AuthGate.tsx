import type { ReactNode } from "react";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";
import Login from "./Login";

// Lukker appen bag login NÅR Supabase er konfigureret (deployet beta).
// Lokal dev uden keys forbliver åben (local fallback).
export default function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();

  if (!isSupabaseConfigured) return <>{children}</>;
  if (loading) {
    return (
      <div className="login">
        <div className="login-card">
          <p className="login-sub">Indlæser…</p>
        </div>
      </div>
    );
  }
  if (!session) return <Login />;
  return <>{children}</>;
}
