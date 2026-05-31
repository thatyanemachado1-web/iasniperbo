create table if not exists public.sniper_live_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sniper_live_state enable row level security;

comment on table public.sniper_live_state is
  'Durable SNIPER BO live app state: clients, recipients, access events, module toggles and dashboard snapshot.';
