-- v1.6.1: Intel's AI insight becomes button-triggered instead of
-- generated on every page load -- calling an LLM API on every single
-- visit was both slow (the page waited on it) and unnecessarily
-- repeated for content that doesn't need to change more than once a
-- day or so. This table holds the single most recently generated
-- insight per user, shown as-is until the user explicitly asks for a
-- new one via the Intel page's "Generate commentary" button (see
-- IntelService.regenerateInsight). A brand-new install has no row
-- here yet -- the page shows a "pending generation" message until the
-- button is pressed for the first time.
create table finance.intel_insights (
  user_id uuid primary key references auth.users(id) on delete cascade,
  insight_text text not null check (char_length(insight_text) between 1 and 2000),
  generated_at timestamptz not null default timezone('utc', now())
);

comment on table finance.intel_insights is
  'One row per user: the most recently generated Intel AI insight, and when it was generated. Only written on explicit request (the "Generate commentary" button), never on page load.';

alter table finance.intel_insights enable row level security;

create policy user_isolation on finance.intel_insights
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on finance.intel_insights to authenticated;
grant all privileges on finance.intel_insights to service_role;
