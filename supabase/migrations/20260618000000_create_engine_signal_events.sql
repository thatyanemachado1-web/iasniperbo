create table if not exists public.engine_signal_events (
  id text primary key,
  event_key text not null,
  engine_key text not null,
  outcome text not null check (outcome in ('green', 'red', 'tie')),
  greens integer not null default 0,
  reds integer not null default 0,
  ties integer not null default 0,
  total_signals integer not null default 0,
  occurred_at timestamptz not null,
  date date not null,
  hour integer not null check (hour between 0 and 23),
  week integer,
  month integer not null,
  year integer not null,
  source text not null default 'dashboard_delta',
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists engine_signal_events_event_key_uidx
  on public.engine_signal_events (event_key);

create index if not exists engine_signal_events_engine_date_hour_idx
  on public.engine_signal_events (engine_key, date, hour);

create index if not exists engine_signal_events_occurred_at_idx
  on public.engine_signal_events (occurred_at desc);

alter table public.engine_signal_events enable row level security;
alter table public.engine_signal_events force row level security;

revoke all on table public.engine_signal_events from anon, authenticated;
grant all on table public.engine_signal_events to service_role;
