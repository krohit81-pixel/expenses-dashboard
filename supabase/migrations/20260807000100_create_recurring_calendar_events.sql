-- v2.2.0: recurring calendar events (weekly-repeating entries — a class
-- timetable, a standing appointment, anything on a fixed weekly pattern).
--
-- finance.calendar_events (v1.1.5) covers one-off/date-range entries;
-- there was no way to say "every Tuesday and Friday, 8:00-9:30am, until
-- the semester ends" without creating one row per occurrence by hand.
-- This table is a *rule*, not individual occurrences — occurrences are
-- computed on the fly from the rule (see
-- src/lib/dates/recurring-calendar-events.ts), the same way
-- finance.recurring_transactions is a template and actual transaction
-- rows are generated/tagged separately, not stored per-occurrence.
--
-- Deliberately general, not class-schedule-specific: title, one or more
-- days of week, one time range, an optional free-text "mode" tag
-- (Online/Offline/whatever), and a bounded start/end date. A single rule
-- can cover multiple days of week at the same time (e.g. "Calculus,
-- Tue+Fri, 8:00-9:30") rather than needing one row per day, since that's
-- the common case for a repeating class.
--
-- "people" reuses the exact same free-text array convention as
-- finance.calendar_events.people and finance.trips.traveler_names —
-- tagging is what lets a rule share the existing Rohit/Aradhana/Ahaana/
-- Rohana visibility filters and per-person colors on /calendar, not a
-- separate filtering system.
--
-- Bounded by design: start_date/end_date are both required (not
-- nullable, no "repeats forever" option) — see the /calendar brainstorm
-- this shipped from. A rule stops producing occurrences once its own
-- end_date passes; there's no separate "pause" step for a semester break.
create table finance.recurring_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  people text[] not null default '{}',
  mode text check (mode is null or char_length(mode) <= 40),
  -- 0 = Sunday .. 6 = Saturday, matching JS Date#getUTCDay() — the
  -- occurrence-expansion helper is UTC-date-based throughout, same as
  -- lib/dates/calendar-grid.ts, to avoid the app-header timezone bug
  -- class of issue documented in the roadmap.
  days_of_week smallint[] not null
    check (array_length(days_of_week, 1) > 0)
    check (days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table finance.recurring_calendar_events is
  'A weekly-repeating calendar rule (class timetable, standing appointment, etc.) — occurrences are computed from the rule, not stored per-date. Bounded by start_date/end_date; there is no indefinite/forever option.';
comment on column finance.recurring_calendar_events.days_of_week is
  '0=Sunday..6=Saturday (JS Date#getUTCDay() convention). One rule can list several days at the same time range, e.g. a class that meets Tue and Fri at the same hour.';
comment on column finance.recurring_calendar_events.mode is
  'Free-text, optional — e.g. "Online"/"Offline". Not an enum: this table is intentionally general-purpose, not class-schedule-specific.';

create index recurring_calendar_events_user_start_idx
  on finance.recurring_calendar_events (user_id, start_date);

create trigger set_recurring_calendar_events_updated_at
  before update on finance.recurring_calendar_events
  for each row execute function finance.set_updated_at();

alter table finance.recurring_calendar_events enable row level security;

create policy user_isolation on finance.recurring_calendar_events
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on finance.recurring_calendar_events to authenticated;
grant all privileges on finance.recurring_calendar_events to service_role;
