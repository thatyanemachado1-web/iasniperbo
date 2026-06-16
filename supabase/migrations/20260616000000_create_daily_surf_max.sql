create table if not exists public.daily_surf_max (
  id uuid primary key default gen_random_uuid(),
  table_id text not null,
  date_br date not null,
  banker_max integer not null default 0,
  player_max integer not null default 0,
  tie_max integer not null default 0,
  current_side text check (current_side in ('BANKER', 'PLAYER', 'TIE') or current_side is null),
  current_count integer not null default 0,
  last_round_id text,
  updated_at timestamptz not null default now(),
  unique (table_id, date_br)
);

create index if not exists daily_surf_max_table_date_idx
  on public.daily_surf_max (table_id, date_br desc);

alter table public.daily_surf_max enable row level security;
alter table public.daily_surf_max force row level security;

revoke all on table public.daily_surf_max from anon, authenticated;
grant all on table public.daily_surf_max to service_role;
