-- Prevent a cold Worker isolate from replacing a complete calendar aggregate
-- with the smaller partial batch currently held in memory. Raw validator rounds
-- and engine signal events remain the canonical sources for later reconciliation.

create or replace function public.guard_calendar_round_counters_monotonic()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.total_rounds < old.total_rounds
     or new.greens < old.greens
     or new.reds < old.reds
     or new.ties < old.ties
     or new.banker_count < old.banker_count
     or new.player_count < old.player_count
     or new.tie_count < old.tie_count
     or coalesce((to_jsonb(new) ->> 'total_signals')::integer, new.total_rounds)
        < coalesce((to_jsonb(old) ->> 'total_signals')::integer, old.total_rounds) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists calendar_daily_stats_monotonic_guard
  on public.calendar_daily_stats;
create trigger calendar_daily_stats_monotonic_guard
before update on public.calendar_daily_stats
for each row execute function public.guard_calendar_round_counters_monotonic();

drop trigger if exists calendar_hourly_stats_monotonic_guard
  on public.calendar_hourly_stats;
create trigger calendar_hourly_stats_monotonic_guard
before update on public.calendar_hourly_stats
for each row execute function public.guard_calendar_round_counters_monotonic();

create or replace function public.guard_engine_calendar_counters_monotonic()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.greens < old.greens
     or new.reds < old.reds
     or new.ties < old.ties
     or new.total_signals < old.total_signals then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists engine_hourly_stats_monotonic_guard
  on public.engine_hourly_stats;
create trigger engine_hourly_stats_monotonic_guard
before update on public.engine_hourly_stats
for each row execute function public.guard_engine_calendar_counters_monotonic();

drop trigger if exists engine_daily_stats_monotonic_guard
  on public.engine_daily_stats;
create trigger engine_daily_stats_monotonic_guard
before update on public.engine_daily_stats
for each row execute function public.guard_engine_calendar_counters_monotonic();

drop trigger if exists engine_weekly_stats_monotonic_guard
  on public.engine_weekly_stats;
create trigger engine_weekly_stats_monotonic_guard
before update on public.engine_weekly_stats
for each row execute function public.guard_engine_calendar_counters_monotonic();

drop trigger if exists engine_monthly_stats_monotonic_guard
  on public.engine_monthly_stats;
create trigger engine_monthly_stats_monotonic_guard
before update on public.engine_monthly_stats
for each row execute function public.guard_engine_calendar_counters_monotonic();

drop trigger if exists engine_yearly_stats_monotonic_guard
  on public.engine_yearly_stats;
create trigger engine_yearly_stats_monotonic_guard
before update on public.engine_yearly_stats
for each row execute function public.guard_engine_calendar_counters_monotonic();
