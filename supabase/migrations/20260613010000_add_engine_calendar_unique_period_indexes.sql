create unique index if not exists engine_hourly_stats_engine_period_hour_uidx
  on public.engine_hourly_stats (engine_key, period_start, hour);

create unique index if not exists engine_daily_stats_engine_period_uidx
  on public.engine_daily_stats (engine_key, period_start);

create unique index if not exists engine_weekly_stats_engine_period_uidx
  on public.engine_weekly_stats (engine_key, period_start);

create unique index if not exists engine_monthly_stats_engine_period_uidx
  on public.engine_monthly_stats (engine_key, period_start);

create unique index if not exists engine_yearly_stats_engine_period_uidx
  on public.engine_yearly_stats (engine_key, period_start);
