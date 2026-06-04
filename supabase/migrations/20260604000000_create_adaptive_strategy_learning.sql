create table if not exists public.adaptive_strategy_rounds (
  id uuid primary key default gen_random_uuid(),
  round_key text not null unique,
  table_name text not null,
  round_id integer not null,
  day date not null,
  time_label text not null,
  result text not null check (result in ('BANKER', 'PLAYER', 'TIE')),
  banker_score integer not null default 0,
  player_score integer not null default 0,
  tie_multiplier numeric,
  previous_sequence text,
  next_result text check (next_result in ('BANKER', 'PLAYER', 'TIE') or next_result is null),
  played_at timestamptz not null,
  source_updated_at timestamptz,
  captured_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists adaptive_strategy_rounds_table_played_idx
  on public.adaptive_strategy_rounds (table_name, played_at desc);

create index if not exists adaptive_strategy_rounds_result_idx
  on public.adaptive_strategy_rounds (result, played_at desc);

create table if not exists public.adaptive_strategy_patterns (
  pattern_id text primary key,
  label text not null,
  kind text not null,
  table_name text not null,
  hour_label text,
  direction text not null check (direction in ('BANKER', 'PLAYER', 'TIE')),
  occurrences integer not null default 0,
  pulled_player integer not null default 0,
  pulled_banker integer not null default 0,
  pulled_tie integer not null default 0,
  sg integer not null default 0,
  g1 integer not null default 0,
  red integer not null default 0,
  expired integer not null default 0,
  assertiveness numeric not null default 0,
  assertiveness_sg numeric not null default 0,
  assertiveness_g1 numeric not null default 0,
  last_seen_at timestamptz,
  green_red_sequence_type text not null default 'none',
  green_red_sequence_count integer not null default 0,
  status text not null check (status in ('frio', 'observacao', 'quente', 'pausado')),
  score numeric not null default 0,
  sample_weak boolean not null default true,
  blocked boolean not null default true,
  paused_reason text,
  updated_at timestamptz not null default now()
);

create index if not exists adaptive_strategy_patterns_ranking_idx
  on public.adaptive_strategy_patterns (direction, status, assertiveness desc, occurrences desc);

create table if not exists public.adaptive_strategy_decision_logs (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  final_score numeric not null default 0,
  allowed boolean not null default false,
  side text check (side in ('BANKER', 'PLAYER', 'TIE') or side is null),
  explanation jsonb not null default '[]'::jsonb,
  score_parts jsonb not null default '[]'::jsonb,
  raw_logs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists adaptive_strategy_decision_logs_created_idx
  on public.adaptive_strategy_decision_logs (created_at desc);
