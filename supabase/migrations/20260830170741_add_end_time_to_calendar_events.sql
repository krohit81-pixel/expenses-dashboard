-- v3.6.8: household request -- a manual calendar event's own duration
-- was always assumed to be 1 hour wherever one was needed (currently
-- only the iCal feed, see build-calendar-feed.ts), even though
-- start_time already exists (v3.2.2). Reported directly: "Bowling"
-- has a real 4-hour duration, not 1 hour. Adds an optional end_time,
-- same nullable `time` column shape as start_time itself (see
-- 20260822102845_add_hourly_reminders.sql) -- null means "no specific
-- end recorded," in which case every reader still falls back to the
-- existing 1-hour-after-start default, so this is purely additive: no
-- existing row's behavior changes until someone actually sets one.
--
-- Deliberately NOT added to finance.trips or the static Ahaana/Rohana
-- school calendars -- same "day-level events don't need a time of day
-- at all" reasoning that kept those two out of the original start_time
-- migration. Recurring calendar events already have a required
-- end_time (they've always needed a real class-length duration) --
-- untouched here.
alter table finance.calendar_events
  add column end_time time;

comment on column finance.calendar_events.end_time is
  'Optional, v3.6.8. Null means no specific end was recorded -- readers (the iCal feed, in particular) fall back to a 1-hour-after-start default in that case, same as before this column existed. Only meaningful once start_time is also set (enforced at the Zod schema level, not the database, same convention start_time/remind_lead_hours already follow).';
