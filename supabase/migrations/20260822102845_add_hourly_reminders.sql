-- v3.2.2: hour-based reminders ("N hours before"), alongside the
-- existing day-based ones (v3.2.0/v3.2.1).
--
-- Scope (household decision, not every event type): only entities that
-- carry a real time of day can meaningfully support "N hours before" —
-- recurring_calendar_events already did (start_time); calendar_events
-- previously only had a date, so this adds an OPTIONAL start_time
-- there too, letting the person add a time when logging an event
-- through the screen. finance.trips deliberately does NOT get a time
-- column or an hour-based option — day-before is enough for a trip,
-- per explicit instruction. The static Ahaana/Rohana school calendars
-- (src/features/calendar/data.ts) aren't touched either, same
-- reasoning as the v3.2.1 school_calendar_event work: no time data
-- exists in that static source to count hours back from.
--
-- remind_lead_hours is nullable and deliberately NOT combined with
-- remind_lead_days into one unified "value + unit" column — keeping
-- both means the existing remind_lead_days column, every read of it,
-- and every day-based detector are untouched. The two are mutually
-- exclusive in practice: ReminderService's day-based detectors skip a
-- row once remind_lead_hours is set (see detect-reminders.ts), and the
-- new hour-based detectors only ever look at rows where it's set. Not
-- constrained to a specific set of values at the database level, same
-- "don't over-constrain a column for a UI-level choice" reasoning as
-- remind_lead_days itself — the v1 UI only offers 3/4 hours.
alter table finance.calendar_events
  add column start_time time,
  add column remind_lead_hours smallint check (remind_lead_hours > 0);

comment on column finance.calendar_events.start_time is
  'Optional time of day, added v3.2.2 alongside hour-based reminders. Null for an event with no specific time (unchanged default/existing behavior) -- remind_lead_hours can only be meaningfully set once this is present (enforced at the Zod schema level, not the database).';
comment on column finance.calendar_events.remind_lead_hours is
  'When set, this event uses an hour-based reminder instead of remind_lead_days -- fires this many hours before start_date+start_time. Mutually exclusive with remind_lead_days in practice; see detectCalendarEventReminders/detectCalendarEventHourlyReminders in src/lib/notifications/detect-reminders.ts.';

alter table finance.recurring_calendar_events
  add column remind_lead_hours smallint check (remind_lead_hours > 0);

comment on column finance.recurring_calendar_events.remind_lead_hours is
  'Same as calendar_events.remind_lead_hours -- when set, every occurrence this rule produces reminds this many hours before its own date+start_time (start_time already exists on this table for every rule) instead of remind_lead_days before the date.';

-- notification_log gains an explicit unit alongside lead_time_days so
-- "3" unambiguously means 3 days or 3 hours -- without this, a 3-day
-- reminder and a 3-hour reminder for the same event would collide in
-- the dedupe key (user_id, event_type, event_key, lead_time_days,
-- channel_type), each looking like a duplicate of the other instead of
-- the two distinct, both-legitimate sends they actually are.
alter table finance.notification_log
  add column lead_time_unit text not null default 'days' check (lead_time_unit in ('days', 'hours'));

comment on column finance.notification_log.lead_time_unit is
  'Disambiguates lead_time_days -- "days" (the v3.2.0/v3.2.1 behavior, default) or "hours" (v3.2.2). Part of the sent-dedupe key alongside lead_time_days so a 3-day and a 3-hour reminder for the same event are never treated as duplicates of each other.';

-- The partial unique index has to be rebuilt to include the new
-- column -- Postgres has no ALTER INDEX to add a column in place.
drop index finance.notification_log_sent_dedupe_idx;
create unique index notification_log_sent_dedupe_idx
  on finance.notification_log (user_id, event_type, event_key, lead_time_days, lead_time_unit, channel_type)
  where status = 'sent';
