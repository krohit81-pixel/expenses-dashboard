-- v4.4.0: Action is a calendar category for calls, submissions and follow-ups.
-- Keep the existing date/time/reminder model; no new rows or task-status model.
begin;

alter table finance.calendar_events
  drop constraint calendar_events_tag_check;

alter table finance.calendar_events
  add constraint calendar_events_tag_check
  check (tag in ('vacation', 'holiday', 'exam', 'event', 'action'));

comment on column finance.calendar_events.tag is
  'One of vacation/holiday/exam/event/action. Action represents a task or follow-up. Trips remain in finance.trips.';

commit;
