alter table public.users
  add column if not exists plan text not null default 'free',
  add column if not exists access_status text not null default 'expired',
  add column if not exists enabled boolean not null default false,
  add column if not exists starts_at timestamptz,
  add column if not exists validity_days integer not null default 0,
  add column if not exists expires_at timestamptz,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_expires_at timestamptz,
  add column if not exists trial_ip_hash text not null default '',
  add column if not exists trial_user_agent_hash text not null default '',
  add column if not exists trial_blocked_reason text not null default '',
  add column if not exists is_blocked boolean not null default false,
  add column if not exists admin_note text not null default '';

create index if not exists users_access_status_idx on public.users (access_status);
create index if not exists users_expires_at_idx on public.users (expires_at);
