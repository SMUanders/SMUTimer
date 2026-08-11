# SMU Tid — Supabase / SMU OS

Appen er bygget til at leve i Supabase/Postgres. Local storage er kun en
dev-fallback og aktiveres, indtil credentials er sat.

## Miljøvariabler (samme to bruges til både data OG login)

Kopiér `.env.example` → `.env.local` og udfyld:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Genstart `npm run dev`. Header viser "Supabase" i stedet for "Lokalt (dev)".
På Netlify sættes de samme to som Environment variables (scope **Builds**).

## Migrations (kør i rækkefølge)

1. `supabase/migrations/0001_init_time_entries.sql` — tabeller (employees,
   time_entries), index, trigger, RLS aktiveret.
2. `supabase/migrations/0002_auth_rls.sql` — **login-beskyttelse**: fjerner den
   åbne V1-adgang og kræver at brugeren er logget ind (authenticated) for at
   læse/skrive data. Ingen roller endnu — alle indloggede må se/redigere alt.

Kør i Supabase SQL Editor (eller `supabase db push`).

## Login (Supabase Auth)

Appen er lukket bag login når Supabase er konfigureret (deployet beta). Lokal dev
uden keys forbliver åben (local fallback).

- **Samme Supabase-projekt som SMU OS / SMU Wiki.** De **eksisterende Supabase
  Auth-brugere genbruges** — login-gaten accepterer alle eksisterende authenticated
  brugere. Der oprettes **ingen ny bruger-database** i SMU Tid.
- **Login-metode:** email/password. Ingen magic link, ingen "glemt kodeord" i V1.
- **Ingen selvregistrering i appen.** Har en medarbejder ikke allerede en bruger,
  oprettes vedkommende manuelt: **Supabase → Authentication → Users → Add user**.
  (Kun undtagelsen — ikke alle fra bunden.)
- **Public sign-ups skal være slået fra:** Supabase → Authentication →
  Providers/Settings → "Allow new users to sign up" deaktiveret.
- Supabase-brugeren er IKKE det samme som "medarbejder". Efter login vælger man
  stadig medarbejder i appen. Bemærk: `employees`-tabellen er SMU Tids egen
  medarbejder-liste (til vælgeren) — ikke auth-brugere.
- "Log ud" findes i headeren (dagsseddel + overblik). Ingen roller eller
  medarbejderbinding endnu.

## Deploy-rækkefølge (vigtig)

For at undgå et vindue hvor appen enten er utilgængelig eller stadig åben:

1. **Kør migration 0002 i Supabase** (strammer RLS til authenticated).
2. **Bekræft login med en eksisterende SMU-bruger** (fra SMU OS / SMU Wiki — samme
   projekt). Opret kun manuelt hvis en medarbejder mangler bruger.
3. **Deploy den nye kode** (git push → Netlify bygger). Den nye kode har
   login-gaten, så så snart RLS er stram OG koden er ude, er appen lukket korrekt.

Kører man 0002 før koden er ude, vil den gamle (ikke-loggede) app få tomme/fejlende
data-kald — derfor kør 0002 og deploy tæt sammen; helst 0002 lige før deploy.

## Arkitektur

- `src/lib/supabaseClient.ts` — ÉN delt Supabase-klient (auth + data deler session).
- `src/lib/auth.ts` — `useAuth`, `signIn`, `signOut`.
- `src/components/AuthGate.tsx` — viser Login eller appen (kun når konfigureret).
- `src/components/Login.tsx` — email/password-login.
- `src/lib/storage/*` — `TimeEntryStore`-interface, local- og Supabase-adapter.

Kategori-træet er fælles og lever i `src/data/categories.ts`. Medarbejderlisten i
`src/data/employees.ts` (også seedet i 0001).
