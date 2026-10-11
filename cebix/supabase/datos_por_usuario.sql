-- Ejecutar UNA sola vez en: Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Antes, la última corrida del modelo y los envíos a comité vivían solo en el navegador
-- (localStorage), así que al entrar desde otra computadora todo aparecía vacío.
-- Ahora se guardan en Supabase, por usuario (RLS: cada cuenta solo ve y modifica lo suyo).

-- 1) Última corrida del modelo / importación de cada usuario (una fila por usuario).
create table if not exists public.user_analysis (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  file_name text,
  run_at timestamptz,
  parcels jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_analysis enable row level security;

drop policy if exists "user_analysis: ver propia" on public.user_analysis;
drop policy if exists "user_analysis: insertar propia" on public.user_analysis;
drop policy if exists "user_analysis: editar propia" on public.user_analysis;
drop policy if exists "user_analysis: borrar propia" on public.user_analysis;

create policy "user_analysis: ver propia"
  on public.user_analysis for select to authenticated using (auth.uid() = user_id);
create policy "user_analysis: insertar propia"
  on public.user_analysis for insert to authenticated with check (auth.uid() = user_id);
create policy "user_analysis: editar propia"
  on public.user_analysis for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_analysis: borrar propia"
  on public.user_analysis for delete to authenticated using (auth.uid() = user_id);

-- 2) Envíos a comité (una fila por parcela enviada).
create table if not exists public.committee_submissions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parcel_id text not null,
  submitted_at timestamptz not null default now(),
  primary key (user_id, parcel_id)
);

alter table public.committee_submissions enable row level security;

drop policy if exists "committee_submissions: ver propios" on public.committee_submissions;
drop policy if exists "committee_submissions: insertar propios" on public.committee_submissions;
drop policy if exists "committee_submissions: editar propios" on public.committee_submissions;
drop policy if exists "committee_submissions: borrar propios" on public.committee_submissions;

create policy "committee_submissions: ver propios"
  on public.committee_submissions for select to authenticated using (auth.uid() = user_id);
create policy "committee_submissions: insertar propios"
  on public.committee_submissions for insert to authenticated with check (auth.uid() = user_id);
create policy "committee_submissions: editar propios"
  on public.committee_submissions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "committee_submissions: borrar propios"
  on public.committee_submissions for delete to authenticated using (auth.uid() = user_id);
