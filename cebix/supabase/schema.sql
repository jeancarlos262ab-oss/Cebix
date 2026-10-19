create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  role text,
  region text,
  avatar_url text,
  avatar_full_url text,
  status text not null default 'active',
  two_factor boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: leer todo autenticado" on public.profiles;
create policy "profiles: leer todo autenticado"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles: editar propio" on public.profiles;
create policy "profiles: editar propio"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, region)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'region'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.parcels_custom (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  polygon_id text,
  name text,
  area numeric,
  yield_estimate numeric,
  confidence numeric,
  score numeric,
  risk text,
  risk_color text,
  region text,
  municipio text,
  region_code text,
  lat double precision,
  lng double precision,
  ndvi numeric,
  evi numeric,
  precip numeric,
  gdd numeric,
  shap jsonb,
  created_at timestamptz not null default now()
);

create index if not exists parcels_custom_user_idx on public.parcels_custom (user_id);

alter table public.parcels_custom enable row level security;

drop policy if exists "parcels_custom: todo autenticado" on public.parcels_custom;
drop policy if exists "parcels_custom: ver propias" on public.parcels_custom;
drop policy if exists "parcels_custom: insertar propias" on public.parcels_custom;
drop policy if exists "parcels_custom: editar propias" on public.parcels_custom;
drop policy if exists "parcels_custom: borrar propias" on public.parcels_custom;

create policy "parcels_custom: ver propias"
  on public.parcels_custom for select to authenticated
  using (auth.uid() = user_id);

create policy "parcels_custom: insertar propias"
  on public.parcels_custom for insert to authenticated
  with check (auth.uid() = user_id);

create policy "parcels_custom: editar propias"
  on public.parcels_custom for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "parcels_custom: borrar propias"
  on public.parcels_custom for delete to authenticated
  using (auth.uid() = user_id);

create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  type text not null check (type in ('signup', 'reset')),
  user_id uuid references auth.users (id) on delete cascade,
  consumed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists otp_codes_lookup_idx
  on public.otp_codes (email, type, consumed, created_at desc);

alter table public.otp_codes enable row level security;

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