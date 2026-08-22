-- v3.2.0: notification infrastructure for calendar-event reminders,
-- first channel Telegram.
--
-- Deliberately generic, not calendar-specific — this is the same
-- Financial-Event-shaped design discussed for card dues/recurring
-- transactions later, applied first to calendar events/trips/recurring
-- calendar events since that's what's being built now. Three tables:
--
-- - notification_channels: where a reminder can be delivered. One row
--   per (user, channel_type) — v1 only ever creates a 'telegram' row.
--   `config` is a jsonb blob so a future channel (email, push,
--   whatsapp) doesn't need its own table, just its own shape inside
--   this column (telegram: {"chat_id": "..."}).
-- - notification_rules: NOT used by this migration's UI yet (the
--   calendar-event reminder toggle stores its lead time directly on
--   the event row — see the ALTER TABLE statements below), but created
--   now since the shape costs nothing extra and is exactly what a
--   later per-event-type default-rule UI (recurring transactions,
--   card dues) will want: one row per (event_type, lead_time_days),
--   so multiple lead times per event type are a few rows, not a
--   schema change.
-- - notification_log: the dedupe/audit trail. A reminder is only ever
--   sent once for a given (event_type, event_key, lead_time_days,
--   channel_type) — lead_time_days is part of the key on purpose: the
--   14-day and 3-day reminders for the *same* underlying event are
--   deliberately two different, both-real sends, not duplicates of
--   each other.
--
-- No new event-type-specific table for "what's due and when" — v3.1's
-- research pass confirmed the existing calendar/finance tables already
-- carry real dates (calendar_events.start_date, trips.start_date,
-- recurring_calendar_events' weekly rule). Financial events (recurring
-- transactions, credit card due dates) will plug into this same
-- notification_log/notification_rules shape later as more detectors,
-- not a redesign.
create type finance.notification_channel_type as enum ('telegram');

create type finance.notification_event_type as enum (
  'calendar_event',
  'trip',
  'recurring_calendar_event'
);

create type finance.notification_status as enum ('sent', 'failed');

create table finance.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  channel_type finance.notification_channel_type not null,
  is_enabled boolean not null default true,
  -- telegram: {"chat_id": "123456789"}. jsonb rather than a dedicated
  -- chat_id column so a future channel type doesn't need its own table.
  config jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, channel_type)
);

comment on table finance.notification_channels is
  'Where a reminder can be delivered. One row per (user, channel_type); v1 only ever populates telegram. config is channel-specific jsonb, verified_at is set once a real test send succeeds.';

create table finance.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type finance.notification_event_type not null,
  lead_time_days smallint not null check (lead_time_days >= 0),
  is_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, event_type, lead_time_days)
);

comment on table finance.notification_rules is
  'Reusable default-lead-time rules for a future per-event-type reminder UI (financial events). Not read by the v3.2.0 calendar-event reminder path, which stores its lead time directly on the event/trip/recurring-rule row instead — see those tables'' remind_lead_days columns.';

create table finance.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type finance.notification_event_type not null,
  -- Stable per underlying obligation/occurrence, e.g.
  -- "calendar_event:{id}", "recurring_calendar_event:{ruleId}:{date}".
  -- Never raw message content — see NotificationLogService for the
  -- exact key shape per event type.
  event_key text not null,
  -- Denormalized snapshot, not a FK to notification_rules — a log row
  -- must stay meaningful even if the source event/rule is later edited
  -- or deleted, and it's what makes "14 days before" and "3 days
  -- before" reminders for the same event distinct log entries rather
  -- than colliding as duplicates.
  lead_time_days smallint not null,
  channel_type finance.notification_channel_type not null,
  status finance.notification_status not null,
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

-- A PARTIAL unique index, not a plain table-level unique constraint —
-- deliberately scoped to status = 'sent' only. A plain constraint
-- across all rows would mean one logged failure permanently blocks
-- every future retry of the exact same reminder (the retry's insert
-- would violate the constraint even though nothing was ever actually
-- sent) — exactly backwards from "a failed notification remains
-- eligible for a subsequent scheduled run". Failed attempts can
-- accumulate freely (each is its own row, useful for debugging); only
-- one 'sent' row is ever allowed per (event, lead time, channel).
create unique index notification_log_sent_dedupe_idx
  on finance.notification_log (user_id, event_type, event_key, lead_time_days, channel_type)
  where status = 'sent';

comment on table finance.notification_log is
  'Dedupe + audit trail for every reminder send attempt. notification_log_sent_dedupe_idx (a partial unique index over sent rows only) is the actual dedupe mechanism: ReminderService checks for an existing sent row before sending, same lookup-then-skip idiom as RecurringTransactionService.applyCycleTags uses for cycle tagging. Failed attempts are logged too but never block a later retry.';

create trigger set_notification_channels_updated_at
  before update on finance.notification_channels
  for each row execute function finance.set_updated_at();

create trigger set_notification_rules_updated_at
  before update on finance.notification_rules
  for each row execute function finance.set_updated_at();

alter table finance.notification_channels enable row level security;
create policy user_isolation on finance.notification_channels
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, update, delete on finance.notification_channels to authenticated;
grant all privileges on finance.notification_channels to service_role;

alter table finance.notification_rules enable row level security;
create policy user_isolation on finance.notification_rules
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, update, delete on finance.notification_rules to authenticated;
grant all privileges on finance.notification_rules to service_role;

alter table finance.notification_log enable row level security;
create policy user_isolation on finance.notification_log
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, update, delete on finance.notification_log to authenticated;
grant all privileges on finance.notification_log to service_role;

-- Per-event reminder toggle + lead time, directly on the three
-- calendar-side tables that can now trigger a reminder. Deliberately
-- NOT a join to notification_rules (see that table's comment) — the
-- household asked for "add event -> option to add a reminder", which
-- is naturally a couple of columns on the event itself, not a separate
-- rule object to create/manage. remind_lead_days is a plain smallint,
-- not constrained to a fixed set of values at the database level, even
-- though the v1 UI only offers 0/1/3 — same "don't over-constrain the
-- column for a UI-level choice" reasoning as recurring_calendar_events'
-- free-text `mode` column.
alter table finance.calendar_events
  add column remind_enabled boolean not null default false,
  add column remind_lead_days smallint not null default 0 check (remind_lead_days >= 0);

alter table finance.trips
  add column remind_enabled boolean not null default false,
  add column remind_lead_days smallint not null default 0 check (remind_lead_days >= 0);

alter table finance.recurring_calendar_events
  add column remind_enabled boolean not null default false,
  add column remind_lead_days smallint not null default 0 check (remind_lead_days >= 0);

comment on column finance.calendar_events.remind_enabled is
  'Whether ReminderService should notify about this event. Off by default — an existing event never starts sending reminders just because this feature shipped.';
comment on column finance.calendar_events.remind_lead_days is
  'Days before start_date to send the reminder (0 = the morning of). Only meaningful when remind_enabled is true.';
comment on column finance.trips.remind_enabled is
  'Whether ReminderService should notify about this trip. Off by default.';
comment on column finance.trips.remind_lead_days is
  'Days before start_date (departure) to send the reminder (0 = the morning of). Only meaningful when remind_enabled is true.';
comment on column finance.recurring_calendar_events.remind_enabled is
  'Whether ReminderService should notify before each occurrence this rule produces. Off by default.';
comment on column finance.recurring_calendar_events.remind_lead_days is
  'Days before each occurrence''s date to send the reminder (0 = the morning of). Applies to every occurrence the rule produces, not just the first.';
