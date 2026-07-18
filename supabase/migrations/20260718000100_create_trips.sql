-- v1.0: Travel, merged into the Calendar tab.
--
-- Booked trips (as opposed to the static Ahaana/Rohana school calendars in
-- src/features/calendar/data.ts, which stay as in-code data, not a table
-- — see docs/03-database-design.md's note on why: there's no reasonable
-- "write path" for someone else's school calendar). A trip is short-lived,
-- user-entered data: destination, date range, flight name, who's going.
--
-- traveler_names is a plain text[] rather than a travelers lookup table +
-- join table (the pattern finance.attachments uses for its link tables).
-- That pattern earns its complexity when the linked entity has its own
-- attributes and needs referential integrity across several parent
-- tables; a traveller here is just a label ("Rohit", "Ahaana", a
-- houseguest's name typed once) with no attributes of its own and only
-- ever links to trips. A denormalized array keeps this a single-table
-- feature instead of a three-table one for what is, in practice, a
-- handful of names typed by one person.
--
-- No cross-reference to any other finance.* table, so this doesn't need
-- an assert_reference_owner-style integrity trigger from
-- 20260710000300_add_finance_integrity_guards.sql.
create table finance.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  destination text not null check (char_length(destination) between 1 and 200),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  flight text check (flight is null or char_length(flight) <= 60),
  traveler_names text[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table finance.trips is
  'Booked travel — separate from the static school-calendar data in code. Shown together with it on /calendar.';
comment on column finance.trips.traveler_names is
  'Denormalized list of who is travelling, e.g. {Rohit,Ahaana}. Free text, not a FK — see migration comment for why.';
comment on column finance.trips.flight is
  'Flight name/number only (e.g. "6E 204"), not a full booking reference — this is a calendar aid, not a travel-document store.';

create index trips_user_start_idx on finance.trips (user_id, start_date);

create trigger set_trips_updated_at
  before update on finance.trips
  for each row execute function finance.set_updated_at();

alter table finance.trips enable row level security;

create policy user_isolation on finance.trips
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Explicit grants, matching 20260710000100's per-table grants for every
-- other finance table — the trailing `alter default privileges` in that
-- migration only covers tables created after it ran, in the same
-- transaction/session, which this later migration is not part of.
grant select, insert, update, delete on finance.trips to authenticated;
grant all privileges on finance.trips to service_role;
