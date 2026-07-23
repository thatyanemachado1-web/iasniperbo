-- Independent, read-only fallback for the admin/client registry when Supabase is unavailable.
-- The Worker only writes snapshots that satisfy the configured identity floor.
create table if not exists client_registry_snapshots (
  id text primary key,
  state_json text not null default '{}',
  identity_count integer not null default 0,
  deleted_count integer not null default 0,
  saved_at text not null,
  updated_at text not null
);

create index if not exists client_registry_snapshots_updated_at_idx
  on client_registry_snapshots (updated_at desc);
