# SMU_APP_STANDARD.md — standard for alle SMU/Signmeup-apps

**Kanonisk kilde.** Dette dokument er standarden for enhver app i SMU-universet (SMU OS, Wiki, Tid, APV, …). `smu-os-v2` er navet — når en ny app startes, **kopiér denne fil ind i det nye repo** og følg den. Afvigelser skal dokumenteres i den enkelte apps `CLAUDE.md`.

Design-detaljer (farver, typografi, komponenter) lever i det separate dokument [`docs/SMU_DESIGN_SYSTEM.md`](docs/SMU_DESIGN_SYSTEM.md). Denne fil dækker arkitektur, stack, backend, auth, sikkerhed og arbejdsmåde.

---

## 1. Grundprincip

- **Ejet kode, bygget til at integreres i SMU OS.** Ikke en løs prototype.
- **Små, fokuserede apps.** Én app løser én ting godt. **Ingen** ERP/dashboard/ekstra moduler før behovet er bevist.
- **Ingen iframe.** Apps integreres som rigtig kode, ikke indlejrede rammer.
- På sigt kombineres apps til ét samlet SMU OS. Byg som om det sker i morgen: delt Supabase, delt auth, delt design.

---

## 2. Stack

Den faktiske, beviste stack i `smu-os-v2` (juni 2026):

| Lag | Valg | Note |
|---|---|---|
| UI | **React 19** + **TypeScript** (strict) | `noUnusedLocals` + `noUnusedParameters` håndhæves — build fejler ved ubrugte variabler |
| Build | **Vite 8** | `npm run build` = `tsc -b && vite build` |
| Styling | **Tailwind CSS 4** via `@tailwindcss/vite` | Konfiguration i CSS med `@theme` (ingen `tailwind.config.js`) |
| Routing | **react-router-dom 7** | |
| Ikoner | **lucide-react** | **Aldrig emojis i UI** |
| PDF | **jsPDF** (+ `html2canvas` ved behov) | Se `src/utils/` for mønstre |
| Backend-klient | **@supabase/supabase-js 2** | Én delt singleton-klient |
| Serverless | **Netlify Functions** (`@netlify/functions`, esbuild) | Kun til ting der kræver hemmelige tokens |
| Node | **Node 20** til builds | ⚠️ Bør pinnes eksplicit — se §9 |
| Tests | **Vitest** (standard-mål) | Ikke opsat i `smu-os-v2` endnu — tilføj ved ny app hvis muligt |

**Minimale dependencies.** Tilføj ikke et bibliotek uden at det er nødvendigt. Foretræk platform/standard frem for ny dep.

---

## 3. Backend — DELT Supabase-projekt

Alle SMU-apps deler **samme Supabase-projekt** (database, auth, RLS). Det er det der gør sammensmeltningen til SMU OS mulig.

- Frontend har kun brug for `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- **App-prefix på alle tabeller** for at undgå kollision i det delte projekt:
  - SMU OS-kernen: `sager`, `kunder`, `brands`, `profiler`, … (uden prefix — historisk kerne)
  - Wiki: `wiki_`
  - Tid: `tid_`
  - APV: `apv_`
  - Nye apps vælger et kort, unikt prefix og holder sig til det.
- **Delte tabeller på tværs af apps:** `profiler` (brugere/roller) og Supabase `auth.users` deles. Læs dem — opret dem ikke igen.
- **Én delt Supabase-klient** pr. app (`src/lib/supabase.ts`, singleton). Auth-session og data deler klient.
- **Storage bag et interface + adapter**, så datalag kan skiftes uden at røre UI.
- **localStorage kun som dev-fallback** — aldrig den endelige dataløsning.

Reference-klient (fra `smu-os-v2`):

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL og anon key mangler i .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## 4. Auth

- **Supabase Auth, email/password.**
- **Login-gate** når Supabase er konfigureret. Lokal dev uden keys må være åben.
- **Genbrug eksisterende brugere** (`fornavn@signmeup.dk`). **Ingen signup i appen.** Public signup er slået fra i Supabase.
- Auth-mønster: en `AuthContext` henter session + `profiler`-rækken ved opstart og lytter på auth-ændringer. En `Layout`-wrapper beskytter ruter og redirecter til `/login` hvis ikke autentificeret.

---

## 5. Roller

- **Ingen roller som udgangspunkt.** Start uden rolle-adskillelse.
- Et **bevist behov** kan begrunde stram rolle/RLS-adskillelse (fx SMU Wiki's medarbejder/admin + godkendelsesflow, eller SMU OS' seks roller). **Dokumentér afvigelsen** i appens `CLAUDE.md`.
- Roller håndhæves **både** i databasen (RLS) **og** i frontend (rolle-tjek i komponenter). Frontend-tjek alene er ikke sikkerhed.
- Brug en `SECURITY DEFINER`-funktion (fx `er_admin()`) i RLS-politikker for at undgå rekursion.

---

## 6. Sikkerhed

- **Nummererede migrations** i den **fælles hub** `smu-os/supabase/migrations/` (format `YYYYMMDDHHMMSS_beskrivelse.sql`), anvendt kun gennem gaten, altid DEV → LIVE: `node scripts/db-apply.mjs --env dev --yes` → verificér → rapport → STOP → efter GO `--env live --yes --bekraeft-live` (se `smu-os/docs/SUPABASE_MIGRATIONS.md`, TR-092). Aldrig `supabase link`, aldrig rå `supabase db push`, ingen egen migrationshistorik i app-repoet.
- **RLS på alle tabeller.** Politikker skrives **kun `to authenticated`** — aldrig åben `using(true)` i prod. Stram videre (rolle/ejer) når behovet er bevist.
- RLS-politikker skrives **i migreringsfilerne** — ikke i Supabase-dashboardet.
- **Audit-kolonner:** `created_by` / `updated_by` = `auth.uid()`. Send `ansvarlig_id`/`created_by` **eksplicit fra klienten** — `DEFAULT auth.uid()` er upålidelig i PostgREST-kontekst.
- **Soft deletes overalt.** Hver tabel har en `slettet: boolean` (eller `aktiv: boolean` for stamdata). **Aldrig hard delete.**
- **Server-hemmeligheder aldrig i frontend-bundle.** Tokens (Economics, service role, o.l.) lever kun i Netlify Functions' miljø. Se §9.

---

## 7. Audit-logning

Betydende dataændringer logges til en append-only aktivitetslog (ingen UPDATE/DELETE i RLS). Konvention for `handling`-værdier:

- `'oprettet'` — nyt objekt
- `'opdateret'` — felter ændret
- `'status_skiftet'` — med `detaljer: { fra, til }`

Ved batch-operationer: brug en bulk-variant der henter bruger+profil **én gang**, ikke pr. række.

---

## 8. Design

**Kilde til sandhed: [`docs/SMU_DESIGN_SYSTEM.md`](docs/SMU_DESIGN_SYSTEM.md)** + `src/index.css` i `smu-os-v2`.

Kort resumé (autoritativt i design-doc'en):
- Palette: navy `#213746` (primær), primær blå `#3f9ed3` (accent), varm beige baggrund `#f4f2ed`.
- Semantik: grøn = ok, amber = advarsel, **rød kun til fejl**.
- Skrifttype: Plus Jakarta Sans (vægte 600/700/800).
- Dansk UI. Ingen gradients, ingen emojis, ingen accent-striber.
- Login, tomme states og fejlskærme skal føles som SMU.

### App-ikon & favicon (standard)
**Navy `#213746` bund + ét enkelt hvidt symbol for appen** (SMU Tid = et **ur**;
hver app vælger et passende symbol — evt. med blå `#3f9ed3` accent). Ingen
tilfældige farver. **Samme ikon bruges som favicon i fanen OG som app-ikon på
mobil** (hjemmeskærm), så alt hænger sammen.
- Kilde: `public/favicon.svg` (skarp i alle størrelser).
- Rasteriseret fra SVG'en: `favicon-32.png`, `favicon-48.png`, `pwa-192x192.png`,
  `pwa-512x512.png`, `apple-touch-icon.png`.
- Linket i `index.html` (favicon + apple-touch) og `manifest.webmanifest` (pwa).

### PWA / hjemmeskærm (standard)
Hver SMU-app skal kunne gemmes på telefonen som app-ikon:
- `public/manifest.webmanifest` — `display: standalone`, `theme_color` navy
  `#213746`, `background_color` beige `#f4f2ed`, ikoner 192 + 512 (+ maskable).
- `index.html` — `manifest`-link, `theme-color`, `apple-touch-icon`,
  `apple-mobile-web-app-capable` + `-title`.
- **App-ikon:** se "App-ikon & favicon" ovenfor (navy bund + hvidt app-symbol;
  samme ikon som favicon). Genereres fra SVG'en — ingen ekstra runtime-dep.
- **Ingen service worker / offline i V1** — kun ikon + standalone-åbning. Appen må
  fortsat kræve internet + login.

---

## 9. Deploy og miljøvariabler

- **Git → Netlify continuous deploy. ALDRIG drag-drop.**
- `netlify.toml` i roden med build-command, publish-dir (`dist`), functions-dir og SPA-redirect. Reference:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- **Node 20** ved build. ⚠️ Pinnes eksplicit — enten `NODE_VERSION = "20"` i `netlify.toml` `[build.environment]` eller en `.nvmrc`. *(Åben opgave i `smu-os-v2`: ikke pinnet endnu.)*

**Miljøvariabler — to strengt adskilte typer:**

| Type | Præfiks | Hvor | Havner i bundle? |
|---|---|---|---|
| Frontend | `VITE_` | `.env.local` (dev) / Netlify UI, scope Builds (prod) | **Ja** — kun anon key og url |
| Server | *(ingen)* | `.env` (dev) / Netlify UI (prod) | **Nej — aldrig** |

- `.env.local` (frontend) og `.env` (server) er begge **gitignored**.
- `.env.example` committes **uden values** som skabelon.
- Ved maskineskift: `.env`-filerne flyttes manuelt. Alt andet er i Git.

---

## 10. Arbejdsmåde

- **Byg i små trin.** **Plan → godkendelse** før større kodeændringer.
- Kør **`tsc` + tests + `npm run build`** efter ændringer. Skriv **hvad der er ændret** + **hvad der skal testes manuelt**.
- **Stop og spørg** ved uklarheder.
- **Alt på dansk:** kode, kommentarer, kommunikation, variabelnavne, tabelnavne, UI-tekst.
- **Kommandoer:** `npm run dev` · `npm run build` · `npm run lint` · `npm run preview`.

**Lukketids-rutine** ved slutningen af en session:
1. Opdatér `CLAUDE.md` med status, nye tabeller/felter, nye sider og dagens beslutninger.
2. Kør `npm run build` for at fange TypeScript-fejl.
3. Commit alt med dansk besked der forklarer *hvorfor*, ikke kun *hvad*.
4. Push til `origin/main`.
5. List manuelle skridt brugeren skal lave på live-databasen (migrationer, brugere, seed-data).

---

> **§11–15 er synkroniseret ordret fra den kanoniske `SMU_APP_STANDARD.md` i smu-os** (platform-update, TR-096).
> §-henvisninger i disse afsnit følger den kanoniske nummerering.

## 11. Platform-navigation og app-identitet

**Status: godkendt standard.** Canonical kilde er `smu-hub/src/platform-nav/` (Model D — filerne kopieres
uændret ind i hver app; se modulets egen `README.md`). Følgende er platformens vedtagne UX-model.

**Teknisk deployet er ikke det samme som frigivet til medarbejdere.** Det er den varige
discoverability-regel: Hub er et produktlandskab, ikke en liste over deployede repositories. En app kan være
live på en URL og alligevel stå som "På vej", indtil den er frigivet som almindeligt arbejdsværktøj — og Hub
må vise en kendt produktretning, før der overhovedet findes kode.

Kataloget har to uafhængige akser: **`status`** (`frigivet` | `paa_vej`) og **`synlighed`**
(`discoverable` | `privat`). **SMU Hub viser hele det synlige SMU-univers**, ikke kun brugerens egne apps:

| Tilstand | Betingelse | Kortets opførsel |
|---|---|---|
| Tilgængelig | frigivet **og** aktiv `app_adgang` | klikbart link |
| Ingen adgang | frigivet + discoverable, brugeren mangler adgang | synligt, ikke klikbart, rolig mærkat "Ingen adgang" |
| På vej | ikke frigivet endnu | dæmpet kort, mærkat "På vej", **aldrig klikbart**, **ingen opfundet URL** |
| *(skjult)* | `privat` app uden adgang | optræder slet ikke i brugerens Hub |

Synlighed vurderes før status, så en privat app aldrig kan lække gennem "På vej"- eller "Ingen adgang"-kortet.
En `paa_vej`-app kræver hverken app-key, roller eller adgange endnu; har den ingen officiel identitet, bruges
en neutral platform-placeholder, som **aldrig** må genbruges som appens fremtidige ikon.

At private apps skjules, er en UX-beslutning oven på RLS — ikke sikkerhedsmekanismen i sig selv.
"Ingen adgang" må ikke ligne en teknisk fejl: grå mærkat, aldrig rød, intet fejlikon. Hub forbliver en
launcher/platformoversigt — **ingen** dashboard-data, sager, tider, notifikationer eller cross-app domænedata.

**AppSwitcheren er daglig navigation**, ikke platformoversigt. Den viser Hub, den aktuelle app (markeret) og
brugerens øvrige **frigivne** apps med adgang. Apps uden adgang, apps "på vej" og private apps uden adgang
hører ikke til der.

**Multi-app arbejde:** navigation sker med almindelige links, så brugeren selv kan vælge ny fane. Tving ikke
al navigation ind i samme fane — en medarbejder skal kunne have OS, Tid og Color åbne samtidig.

**URL-disciplin:** app-kataloget skelner mellem `url` (verificeret live-adresse — det eneste der linkes til)
og `maalUrl` (godkendt målmodel `<app>.smu.signmeup.dk`). Skriv aldrig målmodellen som live-sandhed, og gæt
aldrig en app-key, URL, status eller et ikon.

**Cross-app handoff — godkendt princip, ikke bygget endnu.** En app må deep-linke til en anden app med
relevant kontekst, når modtagerappen ejer arbejdsopgaven (fx OS Sag → "Åbn i Color" / "Registrér tid"):
modtageren ejer opgaven og validerer selv; konteksten er en stabil reference (fx `sag_id`/SMU-nummer), aldrig
kopieret domænedata; adgang afgøres hos modtageren (et link er ikke en adgangstildeling); handoff må åbne i ny
fane; ingen skjult skrivning på tværs af domæner. Konkrete handoffs kræver produktbeslutning først.

## 12. Definition: platformklar app

En ny SMU-app er **platformklar** — altså klar til at komme i Hub og blive rullet ud til medarbejdere — først
når alle relevante punkter er på plads. Punkter der bevidst ikke gælder appen, dokumenteres i dens `CLAUDE.md`.

**Fundament**
1. fælles Supabase-projekt, identity og session (`platformAuthStorage()`);
2. app-key registreret i `app_roller` (og tabel-prefix valgt);
3. adgangsmodel via `app_adgange`/`app_roller` med dokumenterede roller;
4. backend/RLS håndhæver adgangen — frontend-tjek alene er ikke sikkerhed.

**Identitet og ikoner**
5. officielt app-ikon besluttet (opfind ikke et permanent ikon for en app uden identitet);
6. browser-favicon (SVG + PNG-fallback);
7. iOS `apple-touch-icon` 180×180 som PNG — SVG virker ikke;
8. PWA 192×192 og 512×512 + `manifest.webmanifest` med `theme_color`/`background_color`;
9. ægte maskable 512×512 med indholdet inden for 80 %-sikkerhedszonen (genbrug ikke `any`-filen);
10. samme ikon kopieret til Hubs `public/icons/apps/` — Hub viser appens **egen** identitet.

**Navigation**
11. Hub-metadata med verificeret `url`, korrekt `status` (frigivet/på vej) og `synlighed`
    (discoverable/privat) — en app optages først som *frigivet*, når den er besluttet frigivet til
    medarbejdere, ikke når den er deployet;
12. `<AppSwitcher>` placeret i appens topbar med egen `currentAppKey`;
13. synlig vej tilbage til Hub;
14. mobil/responsiv navigation.

**Drift**
15. korrekt subdomæne (`<app>.smu.signmeup.dk`) — indtil cutover står Netlify-adressen som `url`;
16. Git → Netlify continuous deploy (§9), Node 20 pinnet;
17. `npm run build` grøn (+ lint/tests hvor repoet har dem);
18. fælles update-notifikation (`platform-update`, §15) monteret;
19. live QA før bred rollout.

## 13. Checkliste — ny SMU-app

0. Sæt appens produktversion efter §14 (`package.json` → `"version"`, `src/lib/version.ts`, diskret label).
1. Vite + React 19 + TS (strict) projekt. Kopiér `src/index.css`-tokens fra `smu-os-v2`.
2. Kopiér denne `SMU_APP_STANDARD.md` og `docs/SMU_DESIGN_SYSTEM.md` ind.
3. Vælg et unikt tabel-prefix (`wiki_`, `tid_`, `apv_`, …).
4. `src/lib/supabase.ts` — delt singleton mod **samme** Supabase-projekt.
5. `AuthContext` + `Layout`-gate. Genbrug `profiler`/`auth.users` — opret dem ikke.
6. `netlify.toml` + `.env.example` + pin Node 20.
7. Første migration: tabeller med prefix, `slettet`-kolonne, audit-kolonner, RLS `to authenticated`.
8. Kopiér `platform-nav/` + app-ikoner ind, og indsæt `<AppSwitcher>` i topbaren (§11).
9. Kopiér `platform-update/` uændret ind fra `smu-hub` og montér den (§15).
10. Kør §12 igennem, før appen optages i Hub og rulles ud.
11. Skriv appens egen `CLAUDE.md` og dokumentér enhver afvigelse fra denne standard.

## 14. Produktversion

Hver app har **én** produktversion. Beslutning, regler og begrundelse: `PLANNING.md` TR-071. Aktuel
baseline pr. app: `PROJECT_OVERVIEW.md` → *Produktversionering*. Her står kun, hvordan den implementeres.

**Autoritativ kilde er `package.json` → `"version"`.** Ikke git-tags, ikke changelog, ikke database.

**Produktversion ≠ build-id.** Produktversionen er menneskelig og stabil (`v1.0`). Et build-id er et
bygnings-tidsstempel, der kun bruges til update-detektion og fejlsøgning. Build-id'et kommer fra det fælles
modul `platform-update` (§15) — ikke fra `version.ts` — og de to blandes aldrig sammen.

Fire trin, kopieret fra `smu-tid` (referenceimplementeringen):

1. **`package.json`** — sæt `"version"` til baseline, fx `1.0.0`.
2. **`vite.config.ts`** — læs versionen ved build og indlejr den:
   ```ts
   import { readFileSync } from 'node:fs'
   const PRODUCT_VERSION = JSON.parse(readFileSync('./package.json', 'utf-8')).version as string
   export default defineConfig({
     define: { __APP_PRODUCT_VERSION__: JSON.stringify(PRODUCT_VERSION) },
     // …
   })
   ```
   Kræver `@types/node` i `devDependencies` og `"types": ["node"]` i `tsconfig.node.json`.
3. **`src/lib/version.ts`** — kopiér filen fra en eksisterende app. Den deklarerer konstanten, har en
   `'dev'`-fallback til testmiljøer og eksponerer `appProductVersion()`. `formatProductVersion()` klipper
   patch væk, så labelen kun viser `major.minor`.
4. **UI** — én diskret label i topbaren ved siden af `<AppSwitcher>`:
   ```tsx
   <span className="hidden sm:inline text-[11px] font-semibold tabular-nums"
         style={{ color: 'rgba(255,255,255,0.45)' }}>
     {appProductVersion()}
   </span>
   ```
   Ingen fremhævelse, intet redesign. Har appen en testrunner, følger `src/lib/version.test.ts` med.

**Ingen konkurrerende versionsnumre i UI.** Funktionsnavne som "Udskriv ordre v1.4" må ikke vises ved
siden af produktversionen. Statustekster uden tal ("PROTOTYPE · ingen data gemmes") er i orden.

## 15. Update-notifikation (platform-update)

En åben SMU-app skal opdage, at en nyere frontend er deployet, uden at kassere brugerens arbejde. Beslutning:
`PLANNING.md` TR-096. Gælder alle LIVE-apps; bevidst udeladt: SMU Assist, SMU ESG og Projektboard.

**Kanonisk kilde:** `smu-hub/src/platform-update/` (med README). **Model D** som `platform-nav`: mappen
kopieres **uændret** ind i hver app (ingen npm-pakke, intet monorepo, ingen central tjeneste). Ret aldrig lokalt
i en app — ret canonical og kopiér igen til alle apps, så modulet forbliver bit-identisk.

**Produktversion vs. build-id:** produktversionen (§14) er til mennesker. Build-id'et er et tidsstempel pr.
produktionsbuild, som modulets Vite-plugin compiler ind som `__APP_VERSION__` og lægger som `version.json`
**direkte i `dist/`** — aldrig i `public/` og aldrig i repoet.

**UX:**
- **Ny version** → diskret, ikke-modalt banner nederst: "Ny version er klar" + [Opdater]. Tjekkes kun i
  produktion: ved start, ca. hvert 5. minut og når fanen/app-ikonet bliver synligt igen.
- **Lazy-/preload-fejl** (en gammel fane kan ikke hente en kodefil, der er væk efter et deploy) → KUN ét
  centralt recovery-kort med samme tekst og knap — aldrig samtidig med banneret. Hele appen erstattes, også
  header/navigation: én sikker recovery-skærm frem for navigation i en inkonsistent gammel bundle.
- **Ingen automatisk genindlæsning.** Siden genindlæses kun, når brugeren klikker "Opdater".
- `defer` på banneret bruges kun, hvor appen har en åbenlys kritisk redigering (i dag: SMU Tids LeaderDay).

**Implementering i en app:**
1. Kopiér `smu-hub/src/platform-update/` uændret til appens `src/platform-update/`.
2. `vite.config.ts`: `import { platformUpdate } from './src/platform-update/vitePlatformUpdate'` og
   `platformUpdate()` i `plugins`.
3. `main.tsx`: omslut hele appen med `<PlatformUpdateBoundary>` og montér `<UpdateBanner />` som søskende
   uden for den. (Apps med en særlig besked, fx SMU Ports flersprogede, kan bruge `useVersionCheck()` direkte.)
4. Har appen en CSP, skal `connect-src` indeholde `'self'` (fetch af `/version.json`).
5. Verificér efter deploy, at `/version.json` matcher build-id'et i den serverede bundle.
