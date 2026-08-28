import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppMeta } from './platformApps'
import { synligeApps, type AppMedTilstand } from './platformSynlighed'

export type { AppTilstand, AppMedTilstand } from './platformSynlighed'

/**
 * Læser den aktuelle brugers AKTIVE app_adgange (via RLS; explicit user_id-filter, ingen bypass)
 * og klassificerer det app-katalog, brugeren må se. Version-agnostisk (kun React-hooks).
 * Selve synlighedsreglen ligger i `platformSynlighed.ts`.
 *
 * Bruges af Hub, som viser produktlandskabet — også apps brugeren ikke har adgang til.
 * En gyldig (delt) session giver IKKE adgang til noget: kun app_adgange afgør `tilgaengelig`,
 * og RLS/app_roller er fortsat den reelle server-side autorisation. At private apps skjules,
 * er en UX-beslutning oven på RLS — ikke sikkerhedsmekanismen i sig selv.
 */
export function usePlatformApps(supabase: SupabaseClient): { apps: AppMedTilstand[]; loading: boolean } {
  const [keys, setKeys] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aktiv = true
    async function hent() {
      const { data: brugerData } = await supabase.auth.getUser()
      const uid = brugerData.user?.id
      if (!uid) { if (aktiv) { setKeys([]); setLoading(false) } return }

      const { data } = await supabase
        .from('app_adgange')
        .select('app')
        .eq('user_id', uid)
        .eq('aktiv', true)

      if (aktiv) {
        setKeys((data as { app: string }[] | null)?.map((r) => r.app) ?? [])
        setLoading(false)
      }
    }
    hent()
    return () => { aktiv = false }
  }, [supabase])

  // Før adgangene er hentet, kender vi ikke brugerens private apps — derfor vises intet katalog
  // som "færdigt", før `loading` er false. Kaldere skal respektere `loading`.
  return { apps: synligeApps(keys ?? []), loading }
}

/**
 * De apps brugeren faktisk må ÅBNE lige nu: frigivet + aktiv app_adgang + verificeret URL.
 * Bruges af AppSwitcher, som er daglig navigation — ikke platformoversigt.
 * Apps uden adgang, apps på vej og private apps uden adgang hører ikke til her.
 */
export function useAllowedApps(supabase: SupabaseClient): { apps: AppMeta[]; loading: boolean } {
  const { apps, loading } = usePlatformApps(supabase)
  return { apps: apps.filter((a) => a.tilstand === 'tilgaengelig' && a.url), loading }
}
