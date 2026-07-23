create table if not exists dashboard_persistent_results (
  module_key text not null,
  day_key text not null,
  month_key text not null,
  result_id text not null,
  signal_id text,
  round_id text,
  result_type text not null,
  side text,
  attempt text,
  tie_multiplier text,
  created_at text not null,
  display_time_br text not null,
  label text not null,
  payload text not null default '{}',
  updated_at text not null,
  primary key (module_key, day_key, result_id)
);

create index if not exists dashboard_persistent_results_day_module_idx
  on dashboard_persistent_results (day_key, module_key, created_at desc);

create index if not exists dashboard_persistent_results_month_module_idx
  on dashboard_persistent_results (month_key, module_key, created_at desc);

create table if not exists dashboard_monthly_tie_stats (
  month_key text primary key,
  stats text not null default '{}',
  updated_at text not null
);

create table if not exists dashboard_latest_snapshot (
  id text primary key,
  latest_round_id text,
  updated_at text not null,
  revision text,
  payload text not null default '{}',
  created_at text not null
);

create index if not exists idx_dashboard_latest_snapshot_updated_at
  on dashboard_latest_snapshot (updated_at);
