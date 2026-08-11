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

- **Nummererede migrations** i `supabase/migrations/`. Format: `YYYYMMDDHHMMSS_beskrivelse.sql`.
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

## 11. Checkliste — ny SMU-app

1. Vite + React 19 + TS (strict) projekt. Kopiér `src/index.css`-tokens fra `smu-os-v2`.
2. Kopiér denne `SMU_APP_STANDARD.md` og `docs/SMU_DESIGN_SYSTEM.md` ind.
3. Vælg et unikt tabel-prefix (`wiki_`, `tid_`, `apv_`, …).
4. `src/lib/supabase.ts` — delt singleton mod **samme** Supabase-projekt.
5. `AuthContext` + `Layout`-gate. Genbrug `profiler`/`auth.users` — opret dem ikke.
6. `netlify.toml` + `.env.example` + pin Node 20.
7. Første migration: tabeller med prefix, `slettet`-kolonne, audit-kolonner, RLS `to authenticated`.
8. Skriv appens egen `CLAUDE.md` og dokumentér enhver afvigelse fra denne standard.
