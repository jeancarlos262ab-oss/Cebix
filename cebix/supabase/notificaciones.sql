alter table public.profiles
  add column if not exists notif_email  boolean not null default true,   
  add column if not exists notif_risk   boolean not null default true,   
  add column if not exists notif_weekly boolean not null default false;  

create table if not exists public.portfolio_snapshots (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  parcels     jsonb       not null default '[]'::jsonb,  
  last_weekly jsonb,                                      
  updated_at  timestamptz not null default now()
);

alter table public.portfolio_snapshots enable row level security;