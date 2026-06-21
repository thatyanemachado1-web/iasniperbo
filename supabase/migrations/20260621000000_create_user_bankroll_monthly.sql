create table if not exists public.user_bankroll_monthly (
  id text primary key,
  user_id text not null,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2100),
  starting_bankroll numeric not null default 0,
  monthly_goal numeric not null default 0,
  daily_stop_win numeric not null default 0,
  daily_stop_loss numeric not null default 0,
  days_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year, month)
);

create index if not exists user_bankroll_monthly_user_period_idx
  on public.user_bankroll_monthly (user_id, year, month);

alter table public.user_bankroll_monthly enable row level security;
alter table public.user_bankroll_monthly force row level security;

revoke all on table public.user_bankroll_monthly from anon, authenticated;
grant all on table public.user_bankroll_monthly to service_role;
