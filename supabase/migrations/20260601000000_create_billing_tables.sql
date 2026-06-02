create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  city text not null default '',
  country text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  plan text not null check (plan in ('free', 'vip', 'premium')),
  status text not null check (status in ('free', 'pending', 'active', 'expired', 'cancelled', 'past_due')),
  provider text not null default 'mercadopago',
  provider_preference_id text not null default '',
  provider_payment_id text not null default '',
  external_reference text not null default '',
  starts_at date,
  expires_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  email text not null,
  plan text not null check (plan in ('free', 'vip', 'premium')),
  provider text not null default 'mercadopago',
  provider_preference_id text not null default '',
  provider_payment_id text not null default '',
  external_reference text not null default '',
  status text not null default 'pending',
  raw_status text not null default '',
  amount numeric(12,2) not null default 0,
  currency text not null default 'BRL',
  paid_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (lower(email));
create index if not exists subscriptions_email_idx on public.subscriptions (lower(email));
create index if not exists subscriptions_status_expires_idx on public.subscriptions (status, expires_at);
create index if not exists payments_email_idx on public.payments (lower(email));
create unique index if not exists payments_provider_payment_id_uidx
  on public.payments (provider, provider_payment_id)
  where provider_payment_id <> '';

alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
