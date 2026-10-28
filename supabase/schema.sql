-- Raye on the Road: single-row JSON state store
create table if not exists public.kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- Only the service role (server-side) may touch it; no anon/public access.
alter table public.kv enable row level security;
