import { PLATFORM_APPS, type AppMeta } from './platformApps'

/** Brugerens tilstand for en konkret app. */
export type AppTilstand =
  | 'tilgaengelig' // frigivet + aktiv app_adgang → må åbnes
  | 'paa_vej' //     kendt produkt, ikke frigivet endnu → vises dæmpet, aldrig klikbart

export interface AppMedTilstand extends AppMeta {
  tilstand: AppTilstand
}

/**
 * Platformens synlighedsregel — bevidst ren (ingen React, ingen netværk), så den kan
 * læses, genbruges og verificeres isoleret.
 *
 * `null` = appen må ikke optræde i brugerens Hub eller app-skifter overhovedet.
 *
 * ── Gældende produktbeslutning (28. aug. 2026) ───────────────────────────────
 * **For frigivne apps følger synlighed den faktiske app-adgang.** Har brugeren ikke
 * en aktiv `app_adgang`, ses appen slet ikke — hverken i Hub eller i skifteren. Det
 * tidligere "Ingen adgang"-kort er dermed afskaffet for frigivne apps: en medarbejder
 * skal se sit eget arbejdsbord, ikke en liste over døre, der er låst for ham.
 *
 * Det er IKKE en bestemt rolle, der giver synlighed. Enhver gyldig aktiv rolle for
 * appen gør det — `observatoer`, `bruger`, `redaktoer`, `leder`, `admin` eller en
 * app-specifik rolle. Reglen kender ingen rollenavne; den spørger kun, om der findes
 * en aktiv adgang. `app_adgange`/`app_roller` + RLS er fortsat den reelle autorisation,
 * og at skjule en app er UX oven på den — ikke sikkerhedsmekanismen i sig selv.
 *
 * `paa_vej`-apps er bevidst undtaget: de er platformens teaser for kendt produktretning
 * og vises uden adgang, netop fordi der endnu ikke findes en adgang at have.
 */
export function tilstandFor(meta: AppMeta, harAdgang: boolean): AppTilstand | null {
  // Privat: selve eksistensen er følsom (fx MUS). Skjules uanset status.
  // Vurderes først, så en privat app aldrig kan lække gennem teaser-grenen nedenfor.
  if (meta.synlighed === 'privat' && !harAdgang) return null

  // Ikke frigivet endnu → teaser. Der findes ingen adgang at måle på.
  if (meta.status === 'paa_vej') return 'paa_vej'

  // Frigivet: adgang og synlighed følges ad.
  return harAdgang ? 'tilgaengelig' : null
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
