create table if not exists calendar_result_events (
  event_key text primary key,
  module_key text not null,
  engine_key text not null,
  module_label text not null,
  strategy_id text,
  pattern_id text,
  signal_id text,
  round_id text,
  entry_side text,
  entry_at text not null,
  resolved_at text not null,
  entry_day_key text not null,
  entry_hour integer not null check (entry_hour between 0 and 23),
  validity text,
  final_result text not null,
  outcome_class text not null check (outcome_class in ('GREEN', 'RED', 'NEUTRAL')),
  attempt text,
  status text not null default 'CLOSED',
  tie_multiplier text,
  timezone text not null default 'America/Campo_Grande',
  source text not null,
  payload text not null default '{}',
  created_at text not null,
  updated_at text not null
);

create index if not exists calendar_result_events_day_hour_idx
  on calendar_result_events (entry_day_key, entry_hour, engine_key);

create index if not exists calendar_result_events_entry_at_idx
  on calendar_result_events (entry_at desc);

create index if not exists calendar_result_events_module_idx
  on calendar_result_events (engine_key, entry_at desc);

create index if not exists calendar_result_events_signal_idx
  on calendar_result_events (signal_id, round_id);
