create or replace function public.current_auth_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

alter table public.users
  add column if not exists temporary_password_must_change boolean not null default true;

alter table public.sniper_live_state enable row level security;
alter table public.sniper_live_state force row level security;

alter table public.users enable row level security;
alter table public.users force row level security;

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

alter table public.payments enable row level security;
alter table public.payments force row level security;

alter table public.saved_patterns enable row level security;
alter table public.saved_patterns force row level security;

alter table public.pattern_validations enable row level security;
alter table public.pattern_validations force row level security;

alter table public.notification_channels enable row level security;
alter table public.notification_channels force row level security;

alter table public.pattern_notifications enable row level security;
alter table public.pattern_notifications force row level security;

alter table public.pattern_live_hits enable row level security;
alter table public.pattern_live_hits force row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.subscriptions from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.sniper_live_state from anon, authenticated;
revoke all on table public.saved_patterns from anon, authenticated;
revoke all on table public.pattern_validations from anon, authenticated;
revoke all on table public.notification_channels from anon, authenticated;
revoke all on table public.pattern_notifications from anon, authenticated;
revoke all on table public.pattern_live_hits from anon, authenticated;

grant select (id, email, full_name, phone, city, country, created_at, updated_at, temporary_password_must_change)
  on table public.users to authenticated;
grant select on table public.subscriptions to authenticated;
grant select on table public.payments to authenticated;
grant select, insert, update, delete on table public.saved_patterns to authenticated;
grant select, insert, update, delete on table public.pattern_validations to authenticated;
grant select, insert, update, delete on table public.notification_channels to authenticated;
grant select, insert on table public.pattern_notifications to authenticated;
grant select, insert, update on table public.pattern_live_hits to authenticated;

drop policy if exists users_select_own on public.users;
create policy users_select_own
  on public.users
  for select
  to authenticated
  using (lower(email) = public.current_auth_email());

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  to authenticated
  using (lower(email) = public.current_auth_email());

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own
  on public.payments
  for select
  to authenticated
  using (lower(email) = public.current_auth_email());

drop policy if exists saved_patterns_own_all on public.saved_patterns;
create policy saved_patterns_own_all
  on public.saved_patterns
  for all
  to authenticated
  using (lower(user_id) = public.current_auth_email())
  with check (lower(user_id) = public.current_auth_email());

drop policy if exists pattern_validations_own_all on public.pattern_validations;
create policy pattern_validations_own_all
  on public.pattern_validations
  for all
  to authenticated
  using (lower(user_id) = public.current_auth_email())
  with check (lower(user_id) = public.current_auth_email());

drop policy if exists notification_channels_own_all on public.notification_channels;
create policy notification_channels_own_all
  on public.notification_channels
  for all
  to authenticated
  using (lower(user_id) = public.current_auth_email())
  with check (lower(user_id) = public.current_auth_email());

drop policy if exists pattern_notifications_own_read_insert on public.pattern_notifications;
create policy pattern_notifications_own_read_insert
  on public.pattern_notifications
  for select
  to authenticated
  using (lower(user_id) = public.current_auth_email());

drop policy if exists pattern_notifications_own_insert on public.pattern_notifications;
create policy pattern_notifications_own_insert
  on public.pattern_notifications
  for insert
  to authenticated
  with check (lower(user_id) = public.current_auth_email());

drop policy if exists pattern_live_hits_own_read_insert_update on public.pattern_live_hits;
create policy pattern_live_hits_own_read_insert_update
  on public.pattern_live_hits
  for all
  to authenticated
  using (lower(user_id) = public.current_auth_email())
  with check (lower(user_id) = public.current_auth_email());
