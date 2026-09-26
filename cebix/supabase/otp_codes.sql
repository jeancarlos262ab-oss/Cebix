-- Ejecutar una sola vez en Supabase: Dashboard -> SQL Editor -> New query.
--
-- Guarda los códigos de 6 dígitos que las funciones /api/send-otp y
-- /api/verify-otp usan para el registro y la recuperación de contraseña.
-- Solo se lee/escribe con la Service Role Key desde las funciones
-- serverless, así que no necesita políticas de RLS para el navegador; se
-- deja RLS activado sin políticas para que el cliente anónimo no pueda
-- leer ni escribir nada aquí.

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
-- Sin políticas: por defecto RLS deniega todo a los roles "anon"/"authenticated".
-- La service_role usada en /api siempre puede saltarse RLS.

-- Opcional pero recomendado: borra códigos viejos automáticamente.
-- Requiere la extensión pg_cron (Dashboard -> Database -> Extensions).
-- select cron.schedule(
--   'cleanup-otp-codes',
--   '0 * * * *',
--   $$ delete from public.otp_codes where expires_at < now() - interval '1 day' $$
-- );
