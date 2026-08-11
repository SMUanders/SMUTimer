-- SMU Tid — stram RLS til kun authenticated brugere (login-beskyttelse).
-- Kør EFTER 0001. Fjerner den åbne V1-adgang og kræver login for al dataadgang.
--
-- Ingen rollelogik endnu: ALLE indloggede brugere må læse/skrive alt.
-- (Per-medarbejder-adskillelse kan tilføjes senere via auth.uid().)

-- Fjern de åbne V1-policies.
drop policy if exists "v1_open_all" on public.time_entries;
drop policy if exists "v1_read_employees" on public.employees;

-- time_entries: kun authenticated må læse/skrive (anon får ingen adgang).
drop policy if exists "authenticated_all" on public.time_entries;
create policy "authenticated_all" on public.time_entries
  for all
  to authenticated
  using (true)
  with check (true);

-- employees: kun authenticated må læse listen.
drop policy if exists "authenticated_read_employees" on public.employees;
create policy "authenticated_read_employees" on public.employees
  for select
  to authenticated
  using (true);

-- RLS er allerede aktiveret i 0001; sikrer det for en god ordens skyld.
alter table public.time_entries enable row level security;
alter table public.employees enable row level security;
