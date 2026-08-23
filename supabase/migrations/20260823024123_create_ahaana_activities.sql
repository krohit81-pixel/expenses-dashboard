-- v3.4.0: Ahaana's mini app — a self-contained, separately-gated
-- section of Atlas (see src/lib/ahaana-gate.ts, middleware.ts) covering
-- her own weekly activities and studies. Two new tables:
--
-- - finance.ahaana_activities: the recurring weekly template (French,
--   Kickboxing, Horse Riding, an evening study block, etc.) — deliberately
--   the same shape as finance.recurring_calendar_events (bounded
--   start_date/end_date, days_of_week smallint[], one time range) since
--   the underlying "weekly-repeating rule" concept is identical. Kept as
--   its own table rather than reusing recurring_calendar_events: that
--   table feeds the shared family /calendar page (visibility filters,
--   person tagging, shown to everyone), while this one is exclusively
--   Ahaana's own mini app and never rendered there — genuinely different
--   domains that happen to share a shape today, with no reason to stay
--   coupled if either evolves separately later.
-- - finance.ahaana_activity_logs: one row per occurrence once she marks
--   it complete — what she covered, what to cover next (the household's
--   own example: "Monday 6:30-7:30 physics study session... marks this
--   as complete and puts comments of what all she covered and what she
--   should cover next week"). Unique on (activity_id, occurrence_date)
--   so resubmitting the same occurrence's form edits the existing row
--   rather than creating a duplicate.
--
-- Both still belong to the single fixed owner (user_id = OWNER_USER_ID)
-- — there is no separate "Ahaana" user/auth identity in this app (see
-- docs/00-current-state.md's Auth model section); her own access is an
-- app-level password gate on the route, not a second real account.
create table finance.ahaana_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  -- Plain checked text, not an enum — same "don't over-constrain a
  -- UI-level choice" reasoning as recurring_calendar_events.mode.
  category text not null default 'other'
    check (category in ('class', 'sport', 'study', 'other')),
  days_of_week smallint[] not null
    check (array_length(days_of_week, 1) > 0)
    check (days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  -- The general "what's expected" description — the household's own
  -- framing: "a weekly schedule... listing so you get the vision and
  -- overall picture of what is the expectations." Distinct from a
  -- per-occurrence log entry's own covered_notes/next_notes below.
  plan_notes text check (plan_notes is null or char_length(plan_notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table finance.ahaana_activities is
  'The recurring weekly template for Ahaana''s mini app (classes, sport, study blocks) — occurrences are computed from the rule, not stored per-date, same pattern as finance.recurring_calendar_events.';
comment on column finance.ahaana_activities.category is
  'class/sport/study/other — purely descriptive grouping for the weekly view, not used for any access-control decision.';
comment on column finance.ahaana_activities.plan_notes is
  'General "what''s expected" description for this activity, shown on the weekly view — not the same as a specific occurrence''s covered_notes/next_notes in ahaana_activity_logs.';

create table finance.ahaana_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  activity_id uuid not null references finance.ahaana_activities(id) on delete cascade,
  occurrence_date date not null,
  completed_at timestamptz not null default timezone('utc', now()),
  covered_notes text check (covered_notes is null or char_length(covered_notes) <= 2000),
  next_notes text check (next_notes is null or char_length(next_notes) <= 2000),
  created_at timestamptz not null default timezone('utc', now()),
  unique (activity_id, occurrence_date)
);

comment on table finance.ahaana_activity_logs is
  'One row per occurrence once marked complete. covered_notes/next_notes match the household''s own example: "what all she covered and what she should cover next week." Unique on (activity_id, occurrence_date) so resubmitting the same occurrence edits it rather than duplicating.';

create index ahaana_activities_user_start_idx
  on finance.ahaana_activities (user_id, start_date);
create index ahaana_activity_logs_activity_date_idx
  on finance.ahaana_activity_logs (activity_id, occurrence_date);

create trigger set_ahaana_activities_updated_at
  before update on finance.ahaana_activities
  for each row execute function finance.set_updated_at();

alter table finance.ahaana_activities enable row level security;
create policy user_isolation on finance.ahaana_activities
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, update, delete on finance.ahaana_activities to authenticated;
grant all privileges on finance.ahaana_activities to service_role;

alter table finance.ahaana_activity_logs enable row level security;
create policy user_isolation on finance.ahaana_activity_logs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, insert, update, delete on finance.ahaana_activity_logs to authenticated;
grant all privileges on finance.ahaana_activity_logs to service_role;
