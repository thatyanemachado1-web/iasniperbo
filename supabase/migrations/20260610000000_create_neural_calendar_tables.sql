create table if not exists public.calendar_daily_stats (
  id text primary key,
  date date not null,
  year integer not null,
  month integer not null,
  day integer not null,
  weekday text not null,
  total_rounds integer not null default 0,
  greens integer not null default 0,
  reds integer not null default 0,
  ties integer not null default 0,
  banker_count integer not null default 0,
  player_count integer not null default 0,
  tie_count integer not null default 0,
  accuracy numeric not null default 0,
  score numeric not null default 0,
  classification text not null default 'sem_amostra',
  best_hour text not null default '',
  worst_hour text not null default '',
  best_module text not null default '',
  best_force text not null default 'NONE',
  observation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_hourly_stats (
  id text primary key,
  date date not null,
  hour integer not null,
  year integer not null,
  month integer not null,
  day integer not null,
  weekday text not null,
  total_rounds integer not null default 0,
  greens integer not null default 0,
  reds integer not null default 0,
  ties integer not null default 0,
  banker_count integer not null default 0,
  player_count integer not null default 0,
  tie_count integer not null default 0,
  accuracy numeric not null default 0,
  score numeric not null default 0,
  classification text not null default 'sem_amostra',
  banker_percent numeric not null default 0,
  player_percent numeric not null default 0,
  tie_percent numeric not null default 0,
  best_force text not null default 'NONE',
  best_module text not null default '',
  best_reading text not null default '',
  observation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_daily_stats_date_idx on public.calendar_daily_stats (date);
create index if not exists calendar_daily_stats_year_month_idx on public.calendar_daily_stats (year, month);
create index if not exists calendar_hourly_stats_date_hour_idx on public.calendar_hourly_stats (date, hour);
create index if not exists calendar_hourly_stats_year_month_idx on public.calendar_hourly_stats (year, month);

alter table public.calendar_daily_stats enable row level security;
alter table public.calendar_hourly_stats enable row level security;
alter table public.calendar_daily_stats force row level security;
alter table public.calendar_hourly_stats force row level security;

revoke all on table public.calendar_daily_stats from anon, authenticated;
revoke all on table public.calendar_hourly_stats from anon, authenticated;
grant all on table public.calendar_daily_stats to service_role;
grant all on table public.calendar_hourly_stats to service_role;
