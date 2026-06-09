create table if not exists public.validator_rounds (
  id text primary key,
  table_id text not null default 'bac-bo',
  round_id bigint not null,
  result text not null check (result in ('B', 'P', 'T')),
  banker_score integer not null default 0,
  player_score integer not null default 0,
  round_time text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists validator_rounds_table_round_idx
  on public.validator_rounds (table_id, round_id desc);

create index if not exists validator_rounds_created_idx
  on public.validator_rounds (created_at desc);

alter table public.validator_rounds enable row level security;
alter table public.validator_rounds force row level security;

revoke all on table public.validator_rounds from anon, authenticated;
grant all on table public.validator_rounds to service_role;
