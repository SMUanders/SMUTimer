# SMU Tid — satellit-app i SMU/Signmeup-universet

> **SMU Platform.** Dette repo er en del af SMU Platform. Fælles platform-sandhed og sandhedshierarki ligger i
> `smu-os-v2`'s Truth Reset-dokumenter (`PROJECT_OVERVIEW`/`DOMAIN_MODEL`/`DESIGNKATALOG`/`ROADMAP`/`NEXT_STEPS`/`PLANNING`),
> `SMU_APP_STANDARD.md` og det globale Claude Code-lag. Ved konflikt vinder platformens sandhedshierarki.
> Denne fil beskriver kun app-specifikke forhold.

**SMU Tid** (digital dagsseddel) er en lille, fokuseret app i SMU-familien. Den
**deler Supabase-projekt, auth og designunivers** med resten. Navet og den
kanoniske kilde er **`smu-os-v2`**.

- **Standard:** følg `SMU_APP_STANDARD.md` (kopi i roden) — stack, backend, auth,
  sikkerhed, deploy, arbejdsmåde.
- **Design:** følg `docs/SMU_DESIGN_SYSTEM.md` (kopi i repoet). Kilde til farver,
  typografi og hjælpeklasser. Ved tvivl vinder `smu-os-v2/src/index.css`.
- **Tabel-prefix:** denne app bruger prefikset **`tid_`** i det delte Supabase-
  projekt. `profiler` + `auth.users` deles på tværs af apps — læs dem, opret dem
  ikke igen.

## Ved reskin / design-arbejde — LÆS FØRST
Når opgaven handler om styling, layout, farver, komponenter eller "få det til at
ligne SMU":
1. **Læs `docs/SMU_DESIGN_SYSTEM.md` FØR du ændrer styling.** Ufravigeligt.
2. Brug CSS-variabler + hjælpeklasser (`.smu-card`, `.smu-badge*`, `.smu-btn-*`,
   `.smu-input`) — **aldrig rå hex i komponenter**.
3. Hold `@theme`-blokken i `src/index.css` identisk med `smu-os-v2`.
4. "Aldrig bryd": ingen gradients, ingen emojis (Lucide-ikoner), rød kun til fejl,
   font-weight ≥ 600 synligt, border-radius ≥ 8px (14px på kort).
5. Login, tomme states og fejlskærme skal føles som SMU.

## Datamodel (på SMU-standard)
- Tabel: **`tid_time_entries`** (tid_-prefiks). `employee_id uuid → profiler(id)`.
- **SMU-sag (v2.1):** `tid_time_entries`/`tid_current_tasks` har nullable `sag_id uuid`
  (blød ref til `sager.id`, INGEN FK) + `sag_smu_nummer` (display-snapshot). SMU OS ejer
  sager; Tid refererer kun. Søgning sker via OS-ejet read-contract
  `public.tid_sag_search(q)` (SECURITY DEFINER, `har_app_adgang('tid')`, kun minimale
  felter — ingen bred `os`-adgang). Fritekst (`customer`/`order_number`) bevares til
  ikke-sagsbundet arbejde. Hub-migration `20260925120001`. QR = senere inputkanal til
  samme resolver (ikke bygget).
- **Enhed (v2.2, TR-088):** valgfri `enhed_id` (blød ref til `enheder.id`, INGEN FK) + `enhed_visning`
  (snapshot "#3 · beskrivelse · reg.nr · …stel-endelse", v2.2.1) på `tid_time_entries`/`tid_current_tasks`. Enhederne læses via OS-ejet
  `public.tid_sag_enheder(p_sag_id)`; trigger `tid_valider_enhed` afviser enhed fra en anden sag. Én enhed pr.
  registrering; flere/alle enheder = sagsniveau. Aldrig obligatorisk; montage + præcis én aktiv enhed → forvalgt
  (kun når sagen vælges i formularen — eksisterende registreringer omskrives aldrig). Hub-migration `20261019210000`.
- **Medarbejdere = den delte `profiler`** (via `src/lib/people.ts`) — ingen egen
  liste. `nt` vises som "Natasha"; `info` ekskluderes; navne med stort forbogstav.
- **Soft-delete:** `slettet boolean`; sletning markerer i stedet for at fjerne.
- Audit `created_by`/`updated_by` = `auth.uid()`.

- **Update-notifikation:** `src/platform-update/` er en uændret kopi af `smu-hub/src/platform-update/` (Model D) — ret
  aldrig lokalt; ret canonical og kopiér igen. Build-id + `dist/version.json` kommer fra dets Vite-plugin;
  produktversionen ("SMU Tid v2.2") er fortsat `package.json` via `src/lib/version.ts`. Banneret er monteret i
  Admin/EmployeeApp/LeaderDay (LeaderDay med `defer` under redigering). Genindlæsning kun ved klik.

## Kendte afvigelser (mindre — ryd op ved lejlighed)
- **Stack-version:** React 18 + Vite 5 (standarden/`smu-os-v2` er på React 19 +
  Vite 8). Fungerer; kan opgraderes.
- **Ingen append-only aktivitetslog** endnu (har soft-delete + audit-kolonner).
- **App-adgang (frontend-gate):** `AuthGate` kræver `har_app_adgang('tid')` (`src/lib/tidAdgang.ts`) — et
  Hub-login uden `tid`-adgang i `app_adgange` får en "Ingen adgang"-side, der peger på Hub. Deaktiverede
  konti afvises af samme RPC. Ændrer ikke rollemodellen nedenfor.
- **Roller + owner-scope (individuelt login):** SELECT = alle med `har_app_adgang('tid')`
  ser alt. **Skrivning er owner-scopet:** en `medarbejder` kan kun oprette/ændre/slette
  **egne** rækker (`employee_id = auth.uid()`); `leder`/`admin` må korrigere andre;
  `observatoer` er read-only. Håndhæves af RLS (smu-os-v2 migration `20260828140001`)
  og frontend binder `employee_id` til `auth.uid` (`src/lib/identity.ts`). Ingen fælles
  værksteds-PC — individuelt login er en forudsætning.

## Domæne-noter (SMU Tid-specifikt)
- Frokost-split: man–tor 12:00–12:30, fre 10:00–10:30, weekend intet. Pause tælles
  ikke som arbejdstid. Ren logik i `src/lib/lunch.ts` (unit-testet).
- Manuel tidsregistrering, ikke stempelur (Pakke 1.1, v2.2.3): forslag = faktiske tider rundet NED til 5 min;
  medarbejderens tider har forrang, også sluttid efter nu (til og med 23:59). Næste opgave foreslås fra seneste
  registrerede sluttid, også efter nu. Overlap afvises (`finishError`/`konfliktVed` i `src/lib/segment.ts`);
  faktiske pauser/hjælp/omgøring forskydes aldrig — ved konflikt vælger medarbejderen: afkort egen seneste
  registrering, start fra registreret slut, eller annuller. Hjælp = præcise minutter. Lederens editor bruger
  `src/lib/validation.ts`.
- Medarbejderens rettelser går KUN gennem databasefunktioner: `tid_ret_egen_registrering` (egen registrering,
  alle datoer: start, slut, aktivitet, note — overlap-, samtidigheds- og ejerkontrol, historik),
  `tid_slet_egen_registrering` (blød sletning), `tid_afkort_seneste_registrering` (konfliktvalget) og
  `tid_ret_egen_note`. Direkte UPDATE/DELETE på `tid_time_entries` er forbeholdt leder (hub-migrationer
  `20261023100000`, `20261023140000`). INSERT er fortsat bred (se TR-104).
- "Min dag" (v2.3): tryk på en egen registrering → `EntryEditor` i medarbejdertilstand (kun start/slut/aktivitet/note;
  sag, enhed og omgøring vises som tekst). Tryk på et fravær → `AbsenceEditor` (ret, slet, afslut). "Registrér fravær
  denne dag" på enhver dato. Lederen har samme fraværseditor i leder-visningen (på medarbejderens vegne). Fravær
  rettes via eksisterende owner-scope-RLS med versionskontrol (`updated_at`); validering i `absenceError`.
- Lederrettelse = atomisk erstatning via `tid_erstat_registrering` (SECURITY INVOKER, hub-migration
  `20261022180000`): originalen blødt slettet + erstatning indsat i én transaktion — eller intet.
- Valgt dato bevares i adressen (`?dato=`) i Min dag og leder-visningen.
- Forventet arbejdsdag 7,5 t (weekend 0).
- Storage bag interface: `src/lib/storage/` (localAdapter dev-fallback +
  supabaseAdapter). Én delt klient `src/lib/supabaseClient.ts`.
- Routing: simpel sti-switch i `main.tsx`. `/` = medarbejderens egen v2-dag
  (`EmployeeApp`); `/oversigt` = `Admin`/Overblik; deep-link
  `?medarbejder=<id>&dato=<YYYY-MM-DD>` = **leder-visning** af medarbejderens v2-dag
  (`LeaderDay` — "Andreas' dag", rolle-gatede korrektioner, ikke "registrér som").
  `/oversigt?sag=<sag-uuid>&smu=<SMU-nr.>` åbner fanen "Sag" med sagen valgt (`src/lib/sagDeeplink.ts`) — bruges af
  SMU OS' "Tidsforbrug i alt" på sagen (LIVE 19. okt. 2026). Titel/kunde via `tid_sag_search`; registreringerne via sag_id.
  Den gamle v1-dagsseddel (`App.tsx`) + `CurrentTaskCard`/`EntryRow`/`LunchPlaceholderRow`
  er fjernet.

## Kommandoer
`npm run dev` · `npm test` · `npm run build`. Kør tsc/tests/build efter ændringer;
skriv hvad der er ændret + hvad der skal testes manuelt. Alt på dansk.
