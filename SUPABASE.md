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
3. `supabase/migrations/0003_audit_created_by.sql` — **audit**: tilføjer
   `created_by` / `updated_by` (= den indloggede bruger, `auth.uid()`). Udfyldes
   automatisk; kræver individuelle logins for at give mening.
4. `supabase/migrations/0004_tid_prefix_profiler.sql` — **SMU-standard**: omdøber
   `time_entries` → `tid_time_entries`, kobler `employee_id` til den delte
   `profiler(id)`, tilføjer soft-delete (`slettet`), dropper appens egen
   `employees`-tabel. ⚠️ Rydder eksisterende testdata (aftalt).
5. `supabase/migrations/0005_current_tasks.sql` — **"Aktuel opgave"** (status):
   ny tabel `tid_current_tasks` (én pr. medarbejder). RLS kun authenticated.

## SMU-nummer / intern kode (V1 — feltstruktur, ingen SMU OS-opslag endnu)

Feltet der før hed "Kunde/Ordre" hedder nu i UI **"SMU-nummer / intern kode"** og
bruges både på en tidsregistrering og på "Aktuel opgave". **Ingen migration:** værdien
gemmes fortsat i den eksisterende kolonne (`tid_time_entries.customer` og
`tid_current_tasks.order_number`) — kun sproget/strukturen i UI er ændret.

To typer (samme tekstfelt, normaliseres ved gem — `src/lib/smuNumber.ts`):
- **SMU-sag** → primært til kundesager. UI viser fast prefiks "SMU-"; man taster kun
  nummeret (fx `184`). Normaliseres konsekvent til **`SMU-0184`** (accepterer også
  `0184`, `SMU-184`, `SMU0184`).
- **Intern kode** → til intern tid. Foreslåede koder: `INTERN-LAGER`, `INTERN-MASKIN`,
  `INTERN-OPRYDNING`, `INTERN-ADMIN`, `INTERN-SMUOS`, `INTERN-ANDET` (eller en fri kode).

**Valgfrit i beta:** man kan gemme uden SMU-nummer/intern kode — ingen blokering,
ingen advarsel endnu. Værdien føres korrekt med når man går mellem registrering og
Aktuel opgave (begge veje). **Senere** kan SMU Tid slå SMU-nummeret op i SMU OS og
auto-udfylde kunde/sagstitel — det er bevidst ikke bygget endnu.

## "Aktuel opgave" er STATUS — ikke tidsregistrering
`tid_current_tasks` viser "hvad arbejder medarbejderen på lige nu". Den er **helt
adskilt** fra `tid_time_entries`: tæller **aldrig** som arbejdstid og påvirker
ingen tal (arbejdstid, pause, mangler, overarbejde, dagsstatus, ugeoverblik).
**Tidsregistrering sker fortsat manuelt** med start/slut som hidtil. Koden er
bagudkompatibel: mangler tabellen, viser appen bare "Ingen aktuel opgave" (ingen fejl).

Kør i Supabase SQL Editor (eller `supabase db push`).

## Login (Supabase Auth)

Appen er lukket bag login når Supabase er konfigureret (deployet beta). Lokal dev
uden keys forbliver åben (local fallback).

- **Samme Supabase-projekt som SMU OS / SMU Wiki.** De **eksisterende Supabase
  Auth-brugere genbruges** — login-gaten accepterer alle eksisterende authenticated
  brugere. Der oprettes **ingen ny bruger-database** i SMU Tid. På sigt samles alle
  SMU-apps i ét system, så samme brugere går igen.
- **Email-mønster:** `fornavn@signmeup.dk` (fx `anders@signmeup.dk`). Nogle konti
  afviger (fx `nt@signmeup.dk`, `info@signmeup.dk`). Individuelle logins bruges, så
  audit (`created_by`/`updated_by`) kan skelne hvem der handlede.
- **Adgangskode:** kan være en fælles nem kode til alle (min. 6 tegn i Supabase),
  da det er de forskellige emails — ikke koden — der giver identiteten. Login huskes
  pr. enhed, så det er ikke bøvlet i daglig brug.
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

## Audit (hvem oprettede/ændrede)

Efter migration 0003 gemmer hver linje i `time_entries`:
- `created_by` — uid på den bruger der oprettede linjen (auto = `auth.uid()`).
- `updated_by` — uid på den bruger der sidst ændrede den (sat af trigger).

Slå op i **Supabase → Table editor → time_entries** (eller SQL). For at oversætte
uid → person: **Authentication → Users** (uid ↔ email). Bemærk: `employee_id` er
*hvis* dagsseddel linjen er — `created_by`/`updated_by` er *hvem der tastede*.
At vise dette i appens UI er en senere, separat opgave.

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
