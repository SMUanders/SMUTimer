-- SMU Tid — audit: hvem oprettede/ændrede en registrering.
-- Kør EFTER 0002.
--
-- Tilføjer created_by / updated_by = den indloggede Supabase-bruger (auth.uid()).
-- Kræver INDIVIDUELLE logins for at give mening (delte konti kan ikke skelnes) —
-- vi genbruger de eksisterende SMU OS-brugere (fornavn@signmeup.dk).
--
-- Ingen app-ændring nødvendig: felterne udfyldes automatisk af databasen.
-- For at se HVEM: slå uid op i Supabase → Authentication → Users (uid → email).
-- (At vise det i appens UI er en senere, separat opgave.)

alter table public.time_entries
  add column if not exists created_by uuid default auth.uid(),
  add column if not exists updated_by uuid default auth.uid();

-- Udvid den eksisterende updated_at-trigger til også at sætte updated_by ved UPDATE.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

-- Bemærk: eksisterende rækker (oprettet før denne migration) har created_by = NULL.
-- Nye rækker får automatisk created_by/updated_by = den der er logget ind.
