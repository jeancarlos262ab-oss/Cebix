-- Ejecutar UNA sola vez, completo, en: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Junta las 3 piezas que la app necesita en un proyecto de Supabase nuevo:
--   1) profiles       -> perfil de cada usuario (nombre, rol, región...)
--   2) parcels_custom -> parcelas que el equipo captura a mano en la app
--   3) otp_codes      -> códigos de 6 dígitos para registro y recuperación por SMTP

-- ============================================================
-- 1) PROFILES
-- ============================================================
-- Un renglón por usuario de auth.users. Se llena solo: cuando /api/send-otp
-- crea la cuenta (auth.admin.createUser) con name/role/region en los
-- metadatos, el trigger de abajo copia esos datos aquí automáticamente.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  role text,
  region text,
  avatar_url text,
  status text not null default 'active',
  two_factor boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cualquier persona ya logueada puede ver el directorio del equipo.
drop policy if exists "profiles: leer todo autenticado" on public.profiles;
create policy "profiles: leer todo autenticado"
  on public.profiles for select
  to authenticated
  using (true);

-- Cada quien puede editar su propio perfil.
drop policy if exists "profiles: editar propio" on public.profiles;
create policy "profiles: editar propio"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- NOTA: AjustesPage/UsersContext deja que cualquier usuario logueado
-- actualice el perfil de OTRA persona (por ejemplo, para que un admin
-- cambie el rol de alguien más), pero la política de arriba solo lo
-- permite sobre el propio perfil. Si quieres que ese flujo funcione desde
-- el navegador, dime y agregamos una política extra que valide "mi propio
-- rol en profiles es Administradora" antes de dejar editar filas ajenas.

-- Crea el perfil automáticamente cuando se crea el usuario en auth.users
-- (tanto si lo crea /api/send-otp con la Service Role Key, como si algún
-- día se crea de otra forma).
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

-- ============================================================
-- 2) PARCELS_CUSTOM
-- ============================================================
-- Parcelas capturadas a mano desde la app (además del dataset base que ya
-- trae el código en src/data/parcels.js). Es una tabla compartida por todo
-- el equipo, no por usuario, igual que la usa src/context/ParcelsContext.jsx.
create table if not exists public.parcels_custom (
  id uuid primary key default gen_random_uuid(),
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

alter table public.parcels_custom enable row level security;

drop policy if exists "parcels_custom: todo autenticado" on public.parcels_custom;
create policy "parcels_custom: todo autenticado"
  on public.parcels_custom for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- 3) OTP_CODES (registro y recuperación de contraseña por Gmail SMTP)
-- ============================================================
-- Solo se lee/escribe con la Service Role Key desde /api/send-otp y
-- /api/verify-otp, así que no lleva políticas: RLS activado sin políticas
-- deniega todo al navegador (anon/authenticated), y la service_role
-- siempre se salta RLS.
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

-- Opcional: borra códigos viejos automáticamente (requiere la extensión
-- pg_cron: Dashboard -> Database -> Extensions).
-- select cron.schedule(
--   'cleanup-otp-codes',
--   '0 * * * *',
--   $$ delete from public.otp_codes where expires_at < now() - interval '1 day' $$
-- );
