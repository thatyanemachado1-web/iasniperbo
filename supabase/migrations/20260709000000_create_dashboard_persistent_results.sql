create table if not exists public.dashboard_persistent_results (
  module_key text not null,
  day_key date not null,
  month_key text not null,
  result_id text not null,
  signal_id text,
  round_id text,
  result_type text not null,
  side text,
  attempt text,
  tie_multiplier text,
  created_at timestamptz not null,
  display_time_br text not null,
  label text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (module_key, day_key, result_id)
);

create index if not exists dashboard_persistent_results_day_module_idx
  on public.dashboard_persistent_results (day_key desc, module_key, created_at desc);

create index if not exists dashboard_persistent_results_month_module_idx
  on public.dashboard_persistent_results (month_key, module_key, created_at desc);

alter table public.dashboard_persistent_results enable row level security;

comment on table public.dashboard_persistent_results is
  'Durable daily dashboard card results for Neural/Pagante, Surf Analyzer and Padroes IA. Upserted only on confirmed events.';

create table if not exists public.dashboard_monthly_tie_stats (
  month_key text primary key,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_monthly_tie_stats enable row level security;

comment on table public.dashboard_monthly_tie_stats is
  'Durable monthly Tie Radar stats keyed by YYYY-MM, preserved across daily dashboard resets.';
