-- SMU Tid — "Aktuel opgave" (status, IKKE tidsregistrering). Kør EFTER 0004.
--
-- HELT adskilt fra tid_time_entries: én aktuel opgave pr. medarbejder, tæller
-- ALDRIG som arbejdstid og påvirker ingen beregninger. Kun "hvad arbejder
-- medarbejderen på lige nu".

create table if not exists public.tid_current_tasks (
  employee_id  uuid primary key references public.profiler (id),
  category     text not null,
  subcategory  text,
  order_number text,
  note         text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid()
);

alter table public.tid_current_tasks enable row level security;

-- Kun authenticated må læse/skrive. Ingen roller endnu — alle indloggede må alt.
drop policy if exists "authenticated_all" on public.tid_current_tasks;
create policy "authenticated_all" on public.tid_current_tasks
  for all to authenticated using (true) with check (true);

-- Hold updated_at/updated_by friske ved UPDATE (genbruger set_updated_at).
drop trigger if exists tid_current_tasks_set_updated_at on public.tid_current_tasks;
create trigger tid_current_tasks_set_updated_at
  before update on public.tid_current_tasks
  for each row execute function public.set_updated_at();
