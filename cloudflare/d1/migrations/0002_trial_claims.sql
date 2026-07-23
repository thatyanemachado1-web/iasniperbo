-- Durable anti-abuse ledger. Only keyed HMAC values are stored here.
create table if not exists trial_claims (
  claim_id text primary key,
  account_id text not null default '',
  exact_email_hash text not null,
  email_hash text not null,
  phone_hash text,
  phone_local_hash text,
  device_hash text,
  ip_hash text not null,
  user_agent_hash text not null,
  ip_day_key text,
  ip_slot integer,
  status text not null check (status in ('reserved', 'granted', 'denied')),
  reason text not null default '',
  created_at text not null,
  updated_at text not null,
  trial_expires_at text
);

drop index if exists trial_claims_email_active_uidx;
create unique index trial_claims_email_active_uidx
  on trial_claims (email_hash)
  where status in ('reserved', 'granted');

create unique index if not exists trial_claims_phone_active_uidx
  on trial_claims (phone_hash)
  where status in ('reserved', 'granted') and phone_hash is not null and phone_hash <> '';

create unique index if not exists trial_claims_phone_local_active_uidx
  on trial_claims (phone_local_hash)
  where status in ('reserved', 'granted') and phone_local_hash is not null and phone_local_hash <> '';

create unique index if not exists trial_claims_device_active_uidx
  on trial_claims (device_hash)
  where status in ('reserved', 'granted') and device_hash is not null and device_hash <> '';

drop index if exists trial_claims_ip_user_agent_active_uidx;
create index if not exists trial_claims_ip_user_agent_recent_idx
  on trial_claims (ip_hash, user_agent_hash, created_at desc);

create unique index if not exists trial_claims_ip_day_slot_active_uidx
  on trial_claims (ip_hash, ip_day_key, ip_slot)
  where status in ('reserved', 'granted') and ip_day_key is not null and ip_slot is not null;

create index if not exists trial_claims_ip_created_idx
  on trial_claims (ip_hash, created_at desc);

create index if not exists trial_claims_created_idx
  on trial_claims (created_at desc);

create table if not exists trial_claim_meta (
  key text primary key,
  value text not null default '',
  updated_at text not null
);
