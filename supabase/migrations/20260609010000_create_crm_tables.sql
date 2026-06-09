create table if not exists public.crm_clients (
  id uuid primary key,
  name text not null,
  email text not null,
  phone text not null default '',
  notes text not null default '',
  created_by text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_clients_email_uidx
  on public.crm_clients (lower(email));

create table if not exists public.crm_deals (
  id uuid primary key,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  title text not null,
  value numeric(12,2) not null default 0,
  stage text not null default 'novo'
    check (stage in ('novo', 'contato', 'negociacao', 'ganho', 'perdido')),
  notes text not null default '',
  expected_close_date date,
  created_by text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_deals_client_idx
  on public.crm_deals (client_id, updated_at desc);

create index if not exists crm_deals_stage_idx
  on public.crm_deals (stage, updated_at desc);

create table if not exists public.crm_invoices (
  id uuid primary key,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  deal_id uuid references public.crm_deals(id) on delete set null,
  amount numeric(12,2) not null default 0,
  status text not null default 'aberta'
    check (status in ('aberta', 'paga', 'vencida', 'cancelada')),
  due_date date,
  paid_at date,
  notes text not null default '',
  created_by text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_invoices_client_idx
  on public.crm_invoices (client_id, updated_at desc);

create index if not exists crm_invoices_status_due_idx
  on public.crm_invoices (status, due_date);

alter table public.crm_clients enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_invoices enable row level security;

alter table public.crm_clients force row level security;
alter table public.crm_deals force row level security;
alter table public.crm_invoices force row level security;

revoke all on table public.crm_clients from anon, authenticated;
revoke all on table public.crm_deals from anon, authenticated;
revoke all on table public.crm_invoices from anon, authenticated;

grant all on table public.crm_clients to service_role;
grant all on table public.crm_deals to service_role;
grant all on table public.crm_invoices to service_role;
