alter table public.calendar_hourly_stats
  add column if not exists engine_key text not null default 'todos',
  add column if not exists total_signals integer not null default 0;

create index if not exists calendar_hourly_stats_engine_date_hour_idx
  on public.calendar_hourly_stats (engine_key, date, hour);

create table if not exists public.engine_hourly_stats (
  id text primary key,
  engine_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  date date not null,
  hour integer not null check (hour between 0 and 23),
  week integer,
  month integer not null,
  year integer not null,
  greens integer not null default 0,
  reds integer not null default 0,
  ties integer not null default 0,
  total_signals integer not null default 0,
  accuracy numeric not null default 0,
  score numeric not null default 0,
  classification text not null default 'sem_amostra',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engine_daily_stats (
  id text primary key,
  engine_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  date date not null,
  hour integer,
  week integer,
  month integer not null,
  year integer not null,
  greens integer not null default 0,
  reds integer not null default 0,
  ties integer not null default 0,
  total_signals integer not null default 0,
  accuracy numeric not null default 0,
  score numeric not null default 0,
  classification text not null default 'sem_amostra',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engine_weekly_stats (
  id text primary key,
  engine_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  date date not null,
  hour integer,
  week integer not null,
  month integer not null,
  year integer not null,
  greens integer not null default 0,
  reds integer not null default 0,
  ties integer not null default 0,
  total_signals integer not null default 0,
  accuracy numeric not null default 0,
  score numeric not null default 0,
  classification text not null default 'sem_amostra',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engine_monthly_stats (
  id text primary key,
  engine_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  date date not null,
  hour integer,
  week integer,
  month integer not null,
  year integer not null,
  greens integer not null default 0,
  reds integer not null default 0,
  ties integer not null default 0,
  total_signals integer not null default 0,
  accuracy numeric not null default 0,
  score numeric not null default 0,
  classification text not null default 'sem_amostra',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engine_yearly_stats (
  id text primary key,
  engine_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  date date not null,
  hour integer,
  week integer,
  month integer not null,
  year integer not null,
  greens integer not null default 0,
  reds integer not null default 0,
  ties integer not null default 0,
  total_signals integer not null default 0,
  accuracy numeric not null default 0,
  score numeric not null default 0,
  classification text not null default 'sem_amostra',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists engine_hourly_stats_engine_date_hour_idx on public.engine_hourly_stats (engine_key, date, hour);
create index if not exists engine_daily_stats_engine_date_idx on public.engine_daily_stats (engine_key, date);
create index if not exists engine_weekly_stats_engine_year_week_idx on public.engine_weekly_stats (engine_key, year, week);
create index if not exists engine_monthly_stats_engine_year_month_idx on public.engine_monthly_stats (engine_key, year, month);
create index if not exists engine_yearly_stats_engine_year_idx on public.engine_yearly_stats (engine_key, year);

alter table public.engine_hourly_stats enable row level security;
alter table public.engine_daily_stats enable row level security;
alter table public.engine_weekly_stats enable row level security;
alter table public.engine_monthly_stats enable row level security;
alter table public.engine_yearly_stats enable row level security;

alter table public.engine_hourly_stats force row level security;
alter table public.engine_daily_stats force row level security;
alter table public.engine_weekly_stats force row level security;
alter table public.engine_monthly_stats force row level security;
alter table public.engine_yearly_stats force row level security;

revoke all on table public.engine_hourly_stats from anon, authenticated;
revoke all on table public.engine_daily_stats from anon, authenticated;
revoke all on table public.engine_weekly_stats from anon, authenticated;
revoke all on table public.engine_monthly_stats from anon, authenticated;
revoke all on table public.engine_yearly_stats from anon, authenticated;

grant all on table public.engine_hourly_stats to service_role;
grant all on table public.engine_daily_stats to service_role;
grant all on table public.engine_weekly_stats to service_role;
grant all on table public.engine_monthly_stats to service_role;
grant all on table public.engine_yearly_stats to service_role;
