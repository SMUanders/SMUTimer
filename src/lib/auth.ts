import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";

// Enkel auth oven på Supabase Auth. Ingen roller — kun "logget ind / ikke".

export interface AuthState {
  loading: boolean;
  session: Session | null;
}

export function useAuth(): AuthState {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      // Ingen Supabase (lokal dev) → ingen session, ikke loading.
      setLoading(false);
      return;
    }
    let alive = true;
    client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, session };
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase er ikke konfigureret.");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  if (client) await client.auth.signOut();
}
