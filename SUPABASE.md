# SMU Tid — Supabase / SMU OS

Appen er bygget til at leve i Supabase/Postgres. Local storage er kun en
midlertidig dev-fallback og aktiveres, indtil credentials er sat.

## Sådan skiftes til Supabase

1. Opret et Supabase-projekt.
2. Kør migrationen: `supabase/migrations/0001_init_time_entries.sql`
   (SQL editor i Supabase, eller `supabase db push`).
3. Sæt sign-in op (Supabase Auth) så `auth.uid()` findes for hver medarbejder.
4. Kopiér `.env.example` → `.env.local` og udfyld:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Genstart `npm run dev`. Header viser nu "Supabase" i stedet for "Lokalt (dev)".

Ingen anden kode skal ændres — hele appen går gennem storage-interfacet.

## Arkitektur

- `src/lib/storage/types.ts` — `TimeEntryStore`-interface (async).
- `src/lib/storage/localAdapter.ts` — localStorage-fallback (dev).
- `src/lib/storage/supabaseAdapter.ts` — Supabase-adapter (endelig løsning).
- `src/lib/storage/index.ts` — vælger backend ud fra env; Supabase importeres
  dynamisk, så `@supabase/supabase-js` kun kommer med i bundlet når det bruges.

RLS sikrer at hver medarbejder kun ser egne registreringer. Kategori-træet er
fælles for alle og lever i `src/data/categories.ts`.
