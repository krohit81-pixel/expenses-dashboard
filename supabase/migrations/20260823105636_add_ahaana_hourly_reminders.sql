-- v3.4.3: hour-based reminders for Ahaana's own activities ("2 hours
-- before", "1 hour before"), alongside the existing day-based option —
-- same shape the household calendar's own events/recurring rules
-- already have (see 20260822102845_add_hourly_reminders.sql). Her
-- activities always carry a real start_time already (required, not
-- optional like calendar_events'), so there's no "needs a time first"
-- gap to guard against here — every row can use either mode from day
-- one.
--
-- Mutually exclusive with remind_lead_days in practice, same
-- convention as calendar_events/recurring_calendar_events: null means
-- "use remind_lead_days instead" — enforced at read time by
-- detectAhaanaActivityReminders/detectAhaanaActivityHourlyReminders
-- (src/lib/notifications/detect-ahaana-reminders.ts), not by the
-- database.
--
-- No notification_log changes needed — lead_time_unit and the dedupe
-- index already cover "days" vs "hours" for every event type sharing
-- that table, added back in the household calendar's own v3.2.2 pass.
alter table finance.ahaana_activities
  add column remind_lead_hours smallint check (remind_lead_hours > 0);

comment on column finance.ahaana_activities.remind_lead_hours is
  'Same as calendar_events.remind_lead_hours -- when set, this activity''s occurrences remind this many hours before their own date+start_time instead of remind_lead_days before the date. Mutually exclusive with remind_lead_days in practice.';
