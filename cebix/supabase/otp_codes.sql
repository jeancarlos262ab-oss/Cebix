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