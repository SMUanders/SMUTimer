import { PLATFORM_APPS, type AppMeta } from './platformApps'

/** Brugerens tilstand for en konkret app. */
export type AppTilstand =
  | 'tilgaengelig' // frigivet + aktiv app_adgang → må åbnes
  | 'ingen_adgang' // frigivet + discoverable, men uden adgang → vises låst
  | 'paa_vej' //     kendt produkt, ikke frigivet endnu → vises dæmpet, aldrig klikbart

export interface AppMedTilstand extends AppMeta {
  tilstand: AppTilstand
}

/**
 * Platformens synlighedsregel — bevidst ren (ingen React, ingen netværk), så den kan
 * læses, genbruges og verificeres isoleret.
 *
 * `null` = appen må ikke optræde i brugerens Hub overhovedet (privat uden adgang).
 *
 * Rækkefølgen er væsentlig: synlighed vurderes FØR status, så en privat app aldrig
 * kan lække gennem "På vej"- eller "Ingen adgang"-kortet.
 */
export function tilstandFor(meta: AppMeta, harAdgang: boolean): AppTilstand | null {
  if (meta.synlighed === 'privat' && !harAdgang) return null
  if (meta.status === 'paa_vej') return 'paa_vej'
  return harAdgang ? 'tilgaengelig' : 'ingen_adgang'
}

/**
 * Klassificér hele kataloget for én bruger ud fra dennes aktive app-keys fra `app_adgange`.
 * Apps brugeren ikke må se, er filtreret helt væk. Sorteret efter `sortOrder`.
 */
export function synligeApps(aktiveAppKeys: Iterable<string>): AppMedTilstand[] {
  const mine = new Set(aktiveAppKeys)
  return Object.values(PLATFORM_APPS)
    .map((meta): AppMedTilstand | null => {
      const harAdgang = meta.appKey !== null && mine.has(meta.appKey)
      const tilstand = tilstandFor(meta, harAdgang)
      return tilstand === null ? null : { ...meta, tilstand }
    })
    .filter((a): a is AppMedTilstand => a !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Må kortet være et link? Kun frigivne apps med adgang og en verificeret URL. */
export function maaAabnes(app: AppMedTilstand): boolean {
  return app.tilstand === 'tilgaengelig' && Boolean(app.url)
}
