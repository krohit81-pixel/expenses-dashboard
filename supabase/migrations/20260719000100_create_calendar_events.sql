-- v1.1.5: manual calendar events.
--
-- Booked trips (finance.trips, v1.0) cover travel specifically —
-- destination, flight, travellers. There was no way to add anything
-- else to the calendar by hand: a one-off event like "Dinner with
-- someone" doesn't fit the trips shape at all, and the static Ahaana/
-- Rohana school calendars in src/features/calendar/data.ts are
-- deliberately in-code data, not writable (see that file's comment).
-- This table is the write path for everything else: a free-text title
-- tagged with one of the same four categories the static school data
-- already uses (vacation/holiday/exam/event), so a manually-added event
-- looks and sorts exactly like the calendar's existing categories
-- instead of introducing a fifth, unstyled kind of entry.
--
-- "trip" is deliberately excluded from the allowed tag values here —
-- that meaning is already covered by finance.trips itself; allowing it
-- here too would create two different ways to represent the same kind
-- of thing.
create table finance.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  tag text not null check (tag in ('vacation', 'holiday', 'exam', 'event')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table finance.calendar_events is
  'Manually-added calendar entries — free-text events tagged with one of the same categories the static school calendar uses. Shown together with school events and booked trips on /calendar.';
comment on column finance.calendar_events.tag is
  'One of vacation/holiday/exam/event — matches EventTag in src/features/calendar/data.ts, minus "trip" (that meaning belongs to finance.trips, not here).';

create index calendar_events_user_start_idx on finance.calendar_events (user_id, start_date);

create trigger set_calendar_events_updated_at
  before update on finance.calendar_events
  for each row execute function finance.set_updated_at();

alter table finance.calendar_events enable row level security;

create policy user_isolation on finance.calendar_events
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on finance.calendar_events to authenticated;
grant all privileges on finance.calendar_events to service_role;
