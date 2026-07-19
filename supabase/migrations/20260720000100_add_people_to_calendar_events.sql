-- v1.1.6: tag people on manual calendar events.
--
-- Booked trips (finance.trips) already let you tag who's travelling
-- (traveler_names, a plain text[] — see that migration's comment for
-- why this isn't a lookup + join table). Manual calendar events had no
-- equivalent: a "Dinner with the Sharmas" entry couldn't say who it's
-- for. Same free-text array approach here, for the same reason. Rohit
-- and Aradhana are the two people with a dedicated filter chip on the
-- calendar (src/features/travel/travelers.ts), but this column isn't
-- restricted to just those two — a custom name typed in works the same
-- way it already does for trips, it just won't have a filter chip of
-- its own.
alter table finance.calendar_events
  add column people text[] not null default '{}'::text[];

comment on column finance.calendar_events.people is
  'Who this event is tagged for — free-text names, same convention as finance.trips.traveler_names. Empty array means untagged, which always stays visible regardless of the Rohit/Aradhana filter chips.';
