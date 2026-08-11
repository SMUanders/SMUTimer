# SMU App-standard — fællesnævnere for alle SMU mini-apps

Fælles fundament for **alle** SMU-apps (SMU Tid, SMU APV, …). En SMU-app er ejet
kode i vores eget univers, bygget så den senere kan integreres i **SMU OS**.
Denne fil er facit — start hver ny app her.

---

## 1. Teknologi
- **React 18 + Vite + TypeScript**. Responsiv web-app (mobil + desktop).
- **Minimale dependencies** — hold appen let. Ingen tunge UI-frameworks uden behov.
- **Vitest** til unit-tests på ren logik (adskilt fra UI).
- **Node 20** til builds (Netlify).
- Scripts: `npm run dev`, `npm test`, `npm run build`.

## 2. Backend: det DELTE Supabase-projekt
- Alle SMU-apps deler **samme Supabase-projekt** som SMU OS / SMU Wiki
  (Postgres + Auth). Samme brugere går igen på tværs.
- Kun to miljøvariabler: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- ⚠️ **Navngiv app-specifikke tabeller med app-prefix** (fx `apv_...`, `tid_...`)
  for at undgå kollision i det delte projekt. Overvej om data er app-specifik
  (prefix) eller fælles platformsdata (fx en delt personer/medarbejder-tabel).
- **Én delt Supabase-klient** til både auth og data, så login-sessionen (JWT)
  følger med på data-kald (ellers afviser RLS dem). Mønster: `lib/supabaseClient.ts`.
- **Storage bag et interface** med adaptere: en Supabase-adapter (den rigtige) og
  en localStorage-adapter **kun som dev-fallback**. localStorage er ALDRIG den
  endelige dataløsning.

## 3. Auth / login
- **Supabase Auth, email/password.** Login-gate (`AuthGate`) aktiv når Supabase er
  konfigureret; lokal dev uden keys må forblive åben (dev-fallback).
- **Genbrug eksisterende brugere** (`fornavn@signmeup.dk`). Ingen selvregistrering
  i appen. **Public sign-ups slået fra.**
- Fælles nem kode er ok — det er de forskellige **emails**, ikke koden, der giver
  identiteten. Session huskes pr. enhed.
- **Ingen roller som udgangspunkt** — alle indloggede ser/redigerer alt. Men et
  **bevist behov** kan begrunde stram rolle/RLS-adskillelse (fx SMU Wiki's
  medarbejder/admin + godkendelsesflow). En begrundet, dokumenteret afvigelse er
  ikke et brud på standarden.

## 4. Sikkerhed & data (RLS + audit)
- **Nummererede migrations** i `supabase/migrations/` (0001 schema, 0002 auth-RLS,
  0003 audit, …). Kør i rækkefølge; dokumentér deploy-rækkefølgen.
- **RLS: kun `authenticated`** (`to authenticated using(true) with check(true)`).
  Aldrig åben `using(true)` i produktion.
- **Audit-kolonner**: `created_by` / `updated_by` = `auth.uid()` (default på insert
  + trigger på update). Så vi altid ved hvem der oprettede/ændrede.

## 5. SMU-designunivers
- **Kilde til sandhed: `docs/SMU_DESIGN_SYSTEM.md` i SMU OS (`smu-os-v2`).** Følg den
  — værdierne herunder er kun et resumé.
- **"Maj 2026"-palette** (faktisk SMU OS/Wiki-kode — ingen tilfældige farver):
  - Navy `#213746` — **primær** (knapper, brand-accent, overskrifter)
  - Primær blå `#3f9ed3` — accent/links
  - **Varm beige baggrund `#f4f2ed`** — appens grundflade
  - Grøn — ok/positiv · Amber — advarsel · **Rød kun** til fejl/kritisk
  - (Eksakte sekundærfarver: se design-system-doc'en.)
- **Dansk UI.** Samme knap-, felt- og kortstil på tværs af apps.
- **Login, tomme states og fejlskærme skal føles som SMU** (navy brand-accent,
  "SMU OS"-mærkning) — ikke generiske framework-/login-templates.
- Ingen accent-striber/understregninger under titler (AI-look). Brug hvidrum,
  bløde baggrundstoner, ikoner-i-cirkler.

## 6. Deploy
- **Git → Netlify (continuous deploy). ALDRIG drag-drop** (så bages env ikke ind,
  og SPA-routes/`netlify.toml` følger ikke med).
- `netlify.toml` (build `npm run build`, publish `dist`, `NODE_VERSION 20`, SPA
  redirect) **+** `public/_redirects` (`/* /index.html 200`) så SPA-fallback også
  virker uanset metode.
- Env-variabler sættes i **Netlify UI** (scope **Builds**) — Vite bager dem ind
  ved build.
- `.env.local` gitignored; `.env.example` committes uden keys.

## 7. Kodestruktur (genbrug fra SMU Tid)
```
src/
  main.tsx                 // simpel sti-baseret routing + <AuthGate>
  lib/
    supabaseClient.ts      // én delt klient (auth + data)
    auth.ts                // useAuth / signIn / signOut
    storage/               // interface + localAdapter + supabaseAdapter
    <domæne>.ts            // ren, testbar logik (ingen UI)
  data/                    // seed/config (data-drevet)
  components/
    AuthGate.tsx, Login.tsx
    <app-UI>
supabase/migrations/       // 0001, 0002, 0003 …
netlify.toml, public/_redirects, .env.example
SUPABASE.md, SMU_PRINCIPLES.md, SMU_APP_STANDARD.md
```
- Ren domænelogik adskilt fra UI (let at teste + let at løfte ind i SMU OS).
- Data-drevet config i `data/`. Simpel routing; SPA-fallback påkrævet.

## 8. Anti-mål
- Ikke ERP, ikke store dashboards, ikke ekstra moduler **før behovet er bevist**.
- **Ingen iframe-integration.**
- **Ingen localStorage som endelig dataløsning** (kun dev-fallback).
- Hold appen lille og fokuseret.

## 9. Arbejdsmåde
- Byg i **små trin**. Plan → godkendelse før større kodeændringer.
- Kør **tsc + tests + build** efter ændringer.
- Skriv **hvad der er ændret** og **hvad der skal testes manuelt**.
- **Stop og spørg** ved uklarheder.

---

## Startprompt til en ny SMU-app

> Vi skal bygge en ny lille SMU-app (fx **SMU APV**), som senere skal integreres i
> SMU OS. Det er ikke en løs prototype — det bygges som ejet kode efter
> **SMU App-standarden** (`SMU_APP_STANDARD.md`).
>
> **Før du koder:**
> 1. Læs dokumentationen hvis den findes: `SMU_APP_STANDARD.md`, `SMU_PRINCIPLES.md`,
>    `SUPABASE.md`, `PROJECT_OVERVIEW.md`, `DOMAIN_MODEL.md`, `ROADMAP.md`,
>    `NEXT_STEPS.md` + app-specifik spec.
> 2. Undersøg projektstrukturen; genbrug SMU Tid-mønstrene (supabaseClient, auth,
>    AuthGate, storage-adapter, SMU-styling).
> 3. Foreslå hvor appen placeres (eget repo vs. mappe) og hvordan den kobler til
>    det delte Supabase-projekt.
> 4. Foreslå datamodel (**app-prefix på tabeller**) + routes.
> 5. Skriv en kort implementeringsplan.
> 6. Vent på godkendelse før større kodeændringer.
>
> **Faste rammer:** React+Vite+TS, minimale deps, Vitest · delt Supabase-projekt,
> kun de to VITE_-env, én delt klient, storage bag interface, localStorage kun
> dev-fallback · Supabase Auth email/password, login-gate, genbrug brugere, ingen
> signup, ingen roller endnu · RLS kun authenticated + audit (created_by/updated_by)
> · SMU-palette (navy #1D384D primær, blå #2E9BD4, grøn #006140, amber advarsel, rød
> kun fejl), dansk UI, SMU-følelse på login/empty/error · Git→Netlify deploy
> (netlify.toml + _redirects, Node 20).
>
> **Anti-mål:** ingen ERP/dashboard/ekstra moduler før behov · ingen iframe · ingen
> localStorage som endelig data · hold den lille.
>
> **Arbejdsmåde:** små trin · tsc/tests/build efter ændringer · skriv hvad der er
> ændret + hvad jeg skal teste · stop og spørg ved uklarheder.
