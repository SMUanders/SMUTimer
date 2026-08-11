-- SMU Tid — initial schema (dagsseddel).
-- Kør i Supabase (SQL editor eller `supabase db push`).
--
-- Datamodellen matcher klientens TimeEntry 1:1. I V1 vælges medarbejder på en
-- startside (ingen login endnu), så employee_id er en reference til employees.id
-- (ikke auth.uid()). Alle medarbejdere ser alle KATEGORIER (kategori-træet lever
-- i klienten, src/data/categories.ts) — kun REGISTRERINGER er pr. medarbejder.

create extension if not exists pgcrypto;

-- Medarbejdere (matcher src/data/employees.ts).
create table if not exists public.employees (
  id   text primary key,
  name text not null
);

insert into public.employees (id, name) values
  ('anders', 'Anders'),
  ('natasha', 'Natasha'),
  ('henriette', 'Henriette'),
  ('ida', 'Ida'),
  ('marie', 'Marie'),
  ('andreas', 'Andreas'),
  ('sascha', 'Sascha'),
  ('ina', 'Ina'),
  ('lissy', 'Lissy'),
  ('dana', 'Dana')
on conflict (id) do nothing;

create table if not exists public.time_entries (
  id               uuid primary key default gen_random_uuid(),
  employee_id      text not null references public.employees (id),
  work_date        date not null,
  start_time       text not null check (start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  end_time         text not null check (end_time   ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  duration_minutes integer not null check (duration_minutes >= 0),
  category_id      text not null,
  subcategory_id   text,
  customer         text not null default '',
  note             text not null default '',
  is_break         boolean not null default false,
  is_redo          boolean not null default false,
  redo_reason      text,
  redo_note        text not null default '',
  split_group_id   uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists time_entries_employee_date_idx
  on public.time_entries (employee_id, work_date);
create index if not exists time_entries_split_group_idx
  on public.time_entries (split_group_id);

-- Hold updated_at frisk ved enhver UPDATE.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists time_entries_set_updated_at on public.time_entries;
create trigger time_entries_set_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- Row Level Security.
-- V1 har ingen login → policies er åbne (anon/authenticated må alt).
-- ⚠️  Når rigtig medarbejder-login tilføjes, SKAL disse strammes, fx til
--     using (employee_id = auth.uid()) så hver kun ser egne linjer.
alter table public.time_entries enable row level security;
alter table public.employees enable row level security;

drop policy if exists "v1_open_all" on public.time_entries;
create policy "v1_open_all" on public.time_entries
  for all using (true) with check (true);

drop policy if exists "v1_read_employees" on public.employees;
create policy "v1_read_employees" on public.employees
  for select using (true);
