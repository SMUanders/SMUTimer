/**
 * SMU Platform — canonical app-katalog (Model D: kopieres ind i hver app).
 * Kilde-of-truth: smu-hub/src/platform-nav/. Kopiér HELE platform-nav/-mappen + ikonerne
 * (public/icons/apps/) uændret ind i hver app der viser app-skifteren.
 *
 * ── Grundregel ───────────────────────────────────────────────────────────────
 * Hub er et PRODUKTLANDSKAB, ikke en liste over deployede repositories.
 * **Teknisk deployet er ikke det samme som frigivet til medarbejdere.** En app kan
 * være live på en URL og alligevel stå som `paa_vej`, indtil den er frigivet som
 * almindeligt arbejdsværktøj.
 *
 * ── To uafhængige akser ──────────────────────────────────────────────────────
 * `status`     — er produktet frigivet til almindelig brug? (`frigivet` | `paa_vej`)
 * `synlighed`  — hvem må overhovedet se, at appen findes? (`discoverable` | `privat`)
 *
 * Adgang afgøres ALDRIG her. `app_adgange`/`app_roller` + RLS er den autoritative
 * adgangskontrol; dette katalog styrer kun præsentation.
 *
 * ── URL-disciplin ────────────────────────────────────────────────────────────
 * `url`     = VERIFICERET adresse. Hub linker kun til den, når appen er frigivet.
 * `maalUrl` = godkendt målmodel (<app>.smu.signmeup.dk). Dokumentation, ikke live-sandhed.
 *             Udeladt for apps uden besluttet subdomæne — den gættes aldrig.
 * Cutover og live-verificeret 20. aug. 2026: Hub (smu.signmeup.dk), OS (os.smu.signmeup.dk),
 * APV (apv.smu.signmeup.dk) og Wiki (wiki.smu.signmeup.dk); 21. aug. 2026: MUS (mus.smu.signmeup.dk);
 * 26. aug. 2026: Arkiv (arkiv.smu.signmeup.dk).
 * Tid, Color og Source kører fortsat på Netlify, og den delte cookie-session (SSO) virker KUN på
 * *.smu.signmeup.dk — så et hop til en netlify.app-adresse kan kræve nyt login.
 */

/** Er produktet frigivet til almindelig medarbejderbrug? */
export type AppStatus = 'frigivet' | 'paa_vej'

/** Må appen overhovedet ses af brugere uden adgang? */
export type AppSynlighed =
  | 'discoverable' // alle må se at appen findes (med eller uden adgang)
  | 'privat' //       vises KUN til brugere med aktiv app_adgang; ellers slet ikke

export interface AppMeta {
  /** Katalognøgle. Ikke nødvendigvis en app-key i databasen — se `appKey`. */
  key: string
  /**
   * App-key i public.app_adgange / public.app_roller, eller `null` hvis appen
   * endnu ikke har en adgangsmodel. `null` betyder: der findes ingen — den opfindes ikke.
   */
  appKey: string | null
  displayName: string
  description: string
  /** Verificeret adresse, eller `null` hvis der ikke findes en. Gættes aldrig. */
  url: string | null
  /** Godkendt målmodel-adresse. Udeladt når subdomænet ikke er besluttet. */
  maalUrl?: string
  icon: string // sti relativt til den hostende apps origin (public/icons/apps/…)
  sortOrder: number
  status: AppStatus
  synlighed: AppSynlighed
}

/** Neutral placeholder til `paa_vej`-apps uden officiel identitet. Aldrig et app-ikon. */
export const PAA_VEJ_IKON = '/icons/apps/platform-paa-vej.svg'

/** Hub / platformens hoveddør. Har ingen app-key — adgang til Hub er en aktiv profil. */
export const HUB_APP: AppMeta = {
  key: 'hub',
  appKey: null,
  displayName: 'SMU Hub',
  description: 'Platformens hoveddør',
  url: 'https://smu.signmeup.dk',
  maalUrl: 'https://smu.signmeup.dk',
  icon: '/icons/apps/smu-hub.svg',
  sortOrder: 0,
  status: 'frigivet',
  synlighed: 'discoverable',
}

/**
 * SMU-produktlandskabet. Tilføj aldrig en app på et gæt — hverken app-key, URL,
 * ikon, status eller synlighed må antages.
 */
export const PLATFORM_APPS: Record<string, AppMeta> = {
  // ── Frigivet: rigtige arbejdsværktøjer, synlige for alle ──────────────────
  os: {
    key: 'os',
    appKey: 'os',
    displayName: 'SMU OS',
    description: 'Sager, kalkulation, tilbud og kunder',
    url: 'https://os.smu.signmeup.dk',
    maalUrl: 'https://os.smu.signmeup.dk',
    icon: '/icons/apps/smu-os.png',
    sortOrder: 10,
    status: 'frigivet',
    synlighed: 'discoverable',
  },
  tid: {
    key: 'tid',
    appKey: 'tid',
    displayName: 'SMU Tid',
    description: 'Tidsregistrering / digital dagsseddel',
    url: 'https://smutimer.netlify.app',
    maalUrl: 'https://tid.smu.signmeup.dk',
    icon: '/icons/apps/smu-tid.svg',
    sortOrder: 20,
    status: 'frigivet',
    synlighed: 'discoverable',
  },
  apv: {
    key: 'apv',
    appKey: 'apv',
    displayName: 'SMU APV',
    description: 'Arbejdspladsvurdering og arbejdsmiljø',
    // Cutover gennemført: fælles session (SSO) live-verificeret 20. aug. 2026.
    // Tidligere adresse https://smuapv.netlify.app svarer stadig, men er legacy — den deler
    // ikke platform-cookien og må ikke linkes fra Hub/AppSwitcher.
    url: 'https://apv.smu.signmeup.dk',
    maalUrl: 'https://apv.smu.signmeup.dk',
    icon: '/icons/apps/smu-apv.svg',
    sortOrder: 30,
    status: 'frigivet',
    synlighed: 'discoverable',
  },
  wiki: {
    key: 'wiki',
    appKey: 'wiki',
    displayName: 'SMU Wiki',
    description: 'Vejledninger og fælles viden',
    // Cutover gennemført: fælles session (SSO) live-verificeret 20. aug. 2026.
    // Tidligere adresse https://smuwiki.netlify.app svarer stadig, men er legacy — den deler
    // ikke platform-cookien og må ikke linkes fra Hub/AppSwitcher.
    url: 'https://wiki.smu.signmeup.dk',
    maalUrl: 'https://wiki.smu.signmeup.dk',
    icon: '/icons/apps/smu-wiki.svg',
    sortOrder: 40,
    status: 'frigivet',
    synlighed: 'discoverable',
  },
  color: {
    key: 'color',
    appKey: 'color',
    displayName: 'SMU Color',
    description: 'Farveopslag og verifikation',
    url: 'https://smucolor.netlify.app',
    maalUrl: 'https://color.smu.signmeup.dk',
    icon: '/icons/apps/smu-color.svg',
    sortOrder: 50,
    status: 'frigivet',
    synlighed: 'discoverable',
  },

  // ── På vej: kendt produktretning, endnu ikke frigivet ─────────────────────
  source: {
    key: 'source',
    appKey: 'source',
    // Teknisk deployet og har adgangsmodel, men IKKE frigivet som medarbejderværktøj.
    // URL'en er verificeret og bevares som sandhed; Hub linker den ikke, så længe status er paa_vej.
    displayName: 'SMU Source',
    description: 'Produkt- og materialeregister',
    url: 'https://smu-source.netlify.app',
    maalUrl: 'https://source.smu.signmeup.dk',
    icon: '/icons/apps/smu-source.svg', // egen officiel identitet findes allerede
    sortOrder: 60,
    status: 'paa_vej',
    synlighed: 'discoverable',
  },
  arkiv: {
    key: 'arkiv',
    appKey: 'arkiv', // app-key + roller (observatoer/bruger/admin) er live i databasen
    displayName: 'SMU Arkiv',
    description: 'Historik og dokumentation',
    // Read-only medarbejderpilot. Cutover gennemført: fælles session (SSO)
    // live-verificeret 26. aug. 2026 — login i Hub åbner Arkiv uden nyt login.
    // Tidligere adresse https://smu-arkiv.netlify.app svarer stadig, men er legacy —
    // den deler ikke platform-cookien og må ikke linkes fra Hub/AppSwitcher.
    url: 'https://arkiv.smu.signmeup.dk',
    maalUrl: 'https://arkiv.smu.signmeup.dk',
    icon: '/icons/apps/smu-arkiv.svg', // Arkivs egen identitet (arkivboks-glyph)
    sortOrder: 70,
    // frigivet = klikbart for brugere MED adgang; privat = kun synlig for dem.
    // Adgangen er bevidst begrænset (kun pilot-observatører + admin) via app_adgange.
    status: 'frigivet',
    synlighed: 'privat',
  },
  esg: {
    key: 'esg',
    appKey: null, // ingen app-key; der findes endnu ikke et app-repo
    displayName: 'SMU ESG',
    description: 'Miljø- og bæredygtighedsdokumentation',
    url: null,
    icon: PAA_VEJ_IKON,
    sortOrder: 80,
    status: 'paa_vej',
    synlighed: 'discoverable',
  },

  // ── Privat: kun synlig for brugere med aktiv adgang ───────────────────────
  mus: {
    key: 'mus',
    appKey: 'mus',
    displayName: 'SMU MUS',
    description: 'Medarbejderudviklingssamtaler',
    // Cutover gennemført: fælles session (SSO) live-verificeret 21. aug. 2026.
    // Tidligere adresse https://smumus.netlify.app svarer stadig, men er legacy — den deler
    // ikke platform-cookien og må ikke linkes fra Hub/AppSwitcher.
    url: 'https://mus.smu.signmeup.dk',
    maalUrl: 'https://mus.smu.signmeup.dk',
    icon: '/icons/apps/smu-mus.svg',
    sortOrder: 90,
    status: 'frigivet',
    // Fortrolige personoplysninger: brugere uden mus-adgang skal ikke kunne se,
    // at appen overhovedet findes — derfor hverken kort eller "Ingen adgang".
    synlighed: 'privat',
  },
}
