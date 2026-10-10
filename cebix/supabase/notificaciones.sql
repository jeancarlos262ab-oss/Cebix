-- Notificaciones por correo de CEBIX. Ejecutar una vez en Supabase → SQL Editor.

-- 1) Preferencias en el perfil (los mismos tres interruptores de Ajustes → Notificaciones).
alter table public.profiles
  add column if not exists notif_email  boolean not null default true,   -- interruptor general
  add column if not exists notif_risk   boolean not null default true,   -- alertas de riesgo
  add column if not exists notif_weekly boolean not null default false;  -- resumen semanal

-- 2) Última foto del portafolio de cada usuario. La escribe SOLO el servidor (service role):
--    sirve para detectar cambios de semáforo y para armar el resumen semanal.
create table if not exists public.portfolio_snapshots (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  parcels     jsonb       not null default '[]'::jsonb,  -- [{id,name,region,riskColor,score,yieldEstimate,area}]
  last_weekly jsonb,                                      -- conteos del último resumen enviado (para comparar)
  updated_at  timestamptz not null default now()
);

alter table public.portfolio_snapshots enable row level security;
-- Sin políticas a propósito: el navegador no puede leerla ni escribirla; el servidor usa la service role.
