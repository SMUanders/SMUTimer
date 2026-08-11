-- SMU Tid — bring datamodellen på SMU-standard: tid_-prefiks, delt profiler,
-- soft-delete. Kør EFTER 0003.
--
-- ⚠️ Rydder eksisterende (test)registreringer — aftalt, da der ikke er rigtige
-- data endnu. employee_id skifter fra tekst-slug til uuid → public.profiler(id).

-- 1) Ryd testdata (uuid-skiftet kræver tom tabel).
truncate table public.time_entries;

-- 2) Omdøb til tid_-prefiks (indexes, trigger og RLS-policies følger med).
alter table public.time_entries rename to tid_time_entries;

-- 3) employee_id: tekst-slug -> uuid, og peg på den DELTE profiler-tabel.
alter table public.tid_time_entries drop constraint if exists time_entries_employee_id_fkey;
alter table public.tid_time_entries
  alter column employee_id type uuid using employee_id::uuid;
alter table public.tid_time_entries
  add constraint tid_time_entries_employee_fk
  foreign key (employee_id) references public.profiler (id);

-- 4) Soft-delete: markér i stedet for at fjerne.
alter table public.tid_time_entries
  add column if not exists slettet boolean not null default false;

create index if not exists tid_time_entries_aktive_idx
  on public.tid_time_entries (employee_id, work_date) where slettet = false;

-- 5) SMU Tids egen employees-tabel er ikke længere nødvendig (vælgeren læser
--    profiler). Dropper den + dens policy.
drop table if exists public.employees cascade;

-- RLS-policy "authenticated_all" fra 0002 gælder fortsat på den omdøbte tabel.
-- created_by/updated_by-audit (0003) og set_updated_at-trigger gælder også videre.
