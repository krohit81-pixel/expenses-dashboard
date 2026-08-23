-- v3.4.0 Phase 2: real web push notifications for Ahaana's mini app —
-- she has no Telegram, so a genuinely new channel is needed (the
-- existing notification pipeline was built generic enough for exactly
-- this: "adding a second channel later means adding one entry" to the
-- registry, see src/lib/notifications/registry.ts's own comment).
--
-- 'web_push' reuses finance.notification_channels (same table
-- telegram already uses) rather than a new table — config holds the
-- push subscription object (endpoint + keys) instead of a chat ID.
-- NotificationChannelService.mapRow branches on channel_type to build
-- `target` (JSON-stringifies the subscription for web_push, same
-- chat_id read for telegram) — every existing caller (getSendTarget,
-- ReminderService) is untouched, since `target` is still just a
-- `string | null` either way.
alter type finance.notification_channel_type add value 'web_push';

-- A new notification_event_type member for her activity reminders'
-- own dedupe/log entries — same reasoning as school_calendar_event's
-- own addition in v3.2.1: a distinct type keeps notification_log's
-- per-type bookkeeping meaningful rather than overloading an existing
-- value that means something else.
alter type finance.notification_event_type add value 'ahaana_activity';

-- Ahaana's own activities get the exact same reminder toggle shape
-- calendar_events/trips/recurring_calendar_events already have
-- (v3.2.0) — remind_enabled + remind_lead_days, day-based only for
-- now (no remind_lead_hours here; her activities all have a real
-- start_time already, but an hour-based option for her mini app
-- wasn't asked for, unlike the main calendar's — day-based is
-- sufficient for "a reminder before French/kickboxing/a study
-- block").
alter table finance.ahaana_activities
  add column remind_enabled boolean not null default false,
  add column remind_lead_days smallint not null default 0 check (remind_lead_days >= 0);

comment on column finance.ahaana_activities.remind_enabled is
  'Whether ReminderService should push-notify Ahaana before each occurrence this activity produces. Off by default.';
comment on column finance.ahaana_activities.remind_lead_days is
  'Days before each occurrence''s date to send the reminder (0 = the morning of). Applies to every occurrence, not just the first.';
