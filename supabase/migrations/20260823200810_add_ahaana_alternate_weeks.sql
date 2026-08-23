-- v3.4.10: "alternate weeks" for Ahaana's recurring activities — the
-- household's own example: History on Sundays one week, Geography the
-- next. Implemented as two SEPARATE activities (each its own
-- start_date/days_of_week/etc, exactly like every other activity),
-- each flagged alternate_weeks and given a start_date one week apart
-- from the other — see expandAhaanaOccurrences in
-- src/lib/dates/ahaana-activities.ts for how that naturally
-- interleaves them without needing any explicit "which activity owns
-- which parity" concept: each activity's own start_date is its own
-- parity anchor.
--
-- Plain boolean, not an interval/frequency column — "every other
-- week" is the one cadence actually asked for, and the existing
-- days_of_week + start_date/end_date columns already cover "every
-- week" (the default, false) with no change needed there.
alter table finance.ahaana_activities
  add column alternate_weeks boolean not null default false;

comment on column finance.ahaana_activities.alternate_weeks is
  'When true, this activity''s occurrences only fall on every OTHER week counted from its own start_date (that date''s week counts as week 0, kept; the next 7-day block is week 1, skipped; and so on) -- see expandAhaanaOccurrences for the exact math. False (default) means every matching day_of_week, every week, same as before this column existed.';
