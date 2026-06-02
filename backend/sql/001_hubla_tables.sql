create table if not exists users (
  id text primary key,
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  password_hash text not null default '',
  temporary_password_must_change boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  email text not null,
  plan text not null default 'mensal' check (plan in ('free', 'mensal', 'trimestral', 'anual')),
  status text not null default 'pending' check (status in ('pending', 'active', 'cancelled', 'expired')),
  provider text not null default 'hubla',
  provider_subscription_id text not null default '',
  provider_product_id text not null default '',
  transaction_id text not null default '',
  starts_at date,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_provider_subscription_uidx unique (provider, provider_subscription_id)
);

create table if not exists payments (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  subscription_id text references subscriptions(id) on delete set null,
  email text not null,
  plan text not null default 'mensal' check (plan in ('free', 'mensal', 'trimestral', 'anual')),
  provider text not null default 'hubla',
  provider_payment_id text not null default '',
  provider_event_id text not null default '',
  transaction_id text not null default '',
  status text not null default 'pending',
  amount numeric(12,2) not null default 0,
  currency text not null default 'BRL',
  raw_payload text not null default '{}',
  purchase_date date,
  expiration_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider_payment_uidx unique (provider, provider_payment_id)
);

create table if not exists webhook_logs (
  id text primary key,
  provider text not null default 'hubla',
  endpoint text not null default '',
  environment text not null default 'production',
  event_type text not null default '',
  status text not null default '',
  email text not null default '',
  transaction_id text not null default '',
  message text not null default '',
  raw_payload text not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on users (lower(email));
create index if not exists subscriptions_email_status_idx on subscriptions (lower(email), status);
create index if not exists payments_email_created_idx on payments (lower(email), created_at desc);
create index if not exists webhook_logs_provider_created_idx on webhook_logs (provider, created_at desc);
create index if not exists webhook_logs_email_created_idx on webhook_logs (lower(email), created_at desc);
