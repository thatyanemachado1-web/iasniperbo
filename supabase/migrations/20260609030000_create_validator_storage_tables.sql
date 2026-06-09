create table if not exists public.validator_saved_patterns (
  id text primary key,
  user_id text not null,
  name text not null default 'Estrategia Neural',
  table_id text not null default 'bac-bo',
  pattern_json jsonb not null default '[]'::jsonb,
  entry_type text not null default 'BANKER',
  pulled_side text check (pulled_side in ('B', 'P', 'T')),
  gale_limit integer not null default 1,
  tie_protection boolean not null default true,
  destination text not null default 'site'
    check (destination in ('site', 'telegram', 'site_telegram', 'monitor', 'disabled')),
  telegram_channel_id text not null default '',
  message_override text not null default '',
  cooldown_rounds integer not null default 2,
  is_active boolean not null default true,
  validation_json jsonb,
  current_green_streak integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  last_detected_at timestamptz,
  last_detected_round_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists validator_saved_patterns_user_idx
  on public.validator_saved_patterns (user_id, updated_at desc);

create index if not exists validator_saved_patterns_monitor_idx
  on public.validator_saved_patterns (is_active, destination, updated_at desc);

create table if not exists public.validator_channels (
  id text primary key,
  user_id text not null,
  name text not null default 'Canal Telegram',
  bot_token_masked text not null default '',
  bot_token_encoded text not null default '',
  chat_id text not null default '',
  button_link text not null default '',
  is_active boolean not null default true,
  analyzing_enabled boolean not null default false,
  analyzing_cooldown_rounds integer not null default 3,
  templates_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists validator_channels_user_idx
  on public.validator_channels (user_id, updated_at desc);

create index if not exists validator_channels_active_idx
  on public.validator_channels (is_active, updated_at desc);

create table if not exists public.validator_notifications (
  id text primary key,
  type text not null default 'entry',
  user_id text not null default '',
  pattern_id text not null default '',
  channel_id text not null default '',
  round_id bigint not null default 0,
  status text not null default 'sent',
  error text not null default '',
  payload_json jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists validator_notifications_user_idx
  on public.validator_notifications (user_id, sent_at desc);

create index if not exists validator_notifications_channel_round_idx
  on public.validator_notifications (channel_id, round_id desc);

alter table public.validator_saved_patterns enable row level security;
alter table public.validator_channels enable row level security;
alter table public.validator_notifications enable row level security;

alter table public.validator_saved_patterns force row level security;
alter table public.validator_channels force row level security;
alter table public.validator_notifications force row level security;

revoke all on table public.validator_saved_patterns from anon, authenticated;
revoke all on table public.validator_channels from anon, authenticated;
revoke all on table public.validator_notifications from anon, authenticated;

grant all on table public.validator_saved_patterns to service_role;
grant all on table public.validator_channels to service_role;
grant all on table public.validator_notifications to service_role;
