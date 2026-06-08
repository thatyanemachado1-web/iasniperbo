create table if not exists public.saved_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  table_id text not null default 'bac-bo',
  name text not null,
  pattern_json jsonb not null,
  entry_type text not null,
  gale_limit integer not null default 1,
  tie_protection boolean not null default true,
  destination text not null default 'site',
  telegram_channel_id uuid null,
  is_active boolean not null default true,
  cooldown_rounds integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pattern_validations (
  id uuid primary key default gen_random_uuid(),
  saved_pattern_id uuid null references public.saved_patterns(id) on delete cascade,
  user_id text not null,
  table_id text not null default 'bac-bo',
  history_size integer not null,
  total_signals integer not null default 0,
  sg_wins integer not null default 0,
  g1_wins integer not null default 0,
  g2_wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  tie_wins integer not null default 0,
  accuracy numeric null,
  current_streak integer not null default 0,
  best_green_streak integer not null default 0,
  best_loss_streak integer not null default 0,
  details_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  bot_token_encrypted text not null,
  chat_id text not null,
  button_link text null,
  is_active boolean not null default true,
  message_templates_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pattern_notifications (
  id uuid primary key default gen_random_uuid(),
  saved_pattern_id uuid not null references public.saved_patterns(id) on delete cascade,
  channel_id uuid null references public.notification_channels(id) on delete set null,
  user_id text not null,
  destination text not null,
  sent_at timestamptz not null default now(),
  round_id text not null,
  status text not null,
  payload_json jsonb not null default '{}'::jsonb
);

create table if not exists public.pattern_live_hits (
  id uuid primary key default gen_random_uuid(),
  saved_pattern_id uuid not null references public.saved_patterns(id) on delete cascade,
  user_id text not null,
  table_id text not null default 'bac-bo',
  detected_round_id text not null,
  entry_round_id text null,
  entry_type text not null,
  status text not null default 'detected',
  result text null,
  gale_used integer null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists saved_patterns_user_id_idx on public.saved_patterns(user_id);
create index if not exists pattern_validations_user_id_idx on public.pattern_validations(user_id);
create index if not exists notification_channels_user_id_idx on public.notification_channels(user_id);
create index if not exists pattern_notifications_user_id_idx on public.pattern_notifications(user_id);
create index if not exists pattern_live_hits_user_id_idx on public.pattern_live_hits(user_id);
