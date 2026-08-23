# Install & Setup

One-stop guide for getting this app running, both locally and on Vercel.
If something breaks, check [Troubleshooting](#troubleshooting) first — it
covers every error this project has actually hit so far.

## Prerequisites

- Node.js 20+
- A Supabase project with the `finance` schema migrated in (see
  `supabase/migrations/`) and exposed in the project's API settings
- A Vercel account, for deployment

## 1. Create the owner account (one time only)

This app has no sign-in screen and no session — every request runs as a
single fixed "owner" account. That account has to exist in Supabase Auth
before the app can start, but you only ever create it once, not per
environment or per deploy.

```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# and SUPABASE_SERVICE_ROLE_KEY in .env.local first, then:
npm run bootstrap:owner you@example.com
```

The email doesn't need to be real or receive mail — it's just an
identifier. The script prints something like:

```
APP_OWNER_USER_ID=3f2a1c9e-....
```

Copy that whole line into `.env.local`, and add the same variable in
Vercel (see step 3). That's the only credential this app has — there's no
password, because nothing ever signs in again after this one-time setup.

**Don't run this script more than once per Supabase project.** If you
accidentally do, or need the ID again later, find the user in Supabase →
Authentication → Users and copy their ID from there instead.

## 2. Environment variables

| Variable                                 | Where to find it                                                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`               | Supabase → Project Settings → API → Project URL                             | Safe to expose to the browser                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`          | Supabase → Project Settings → API → `anon` `public` key                     | Safe to expose to the browser                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`              | Supabase → Project Settings → API → `service_role` key                      | **Secret.** This is now the ONLY way the app talks to the database — there's no session-based access anymore. Never expose to the browser.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `APP_OWNER_USER_ID`                      | Printed by `npm run bootstrap:owner` (step 1)                               | The fixed account every row in the database belongs to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ANTHROPIC_API_KEY`                      | console.anthropic.com → API Keys                                            | **Optional**, added in v0.3. Powers Intel's AI insight only. If unset, Intel's charts still work — the insight card just shows a "not available" message.                                                                                                                                                                                                                                                                                                                                                                                    |
| `GEMINI_API_KEY`                         | aistudio.google.com → Get API Key                                           | **Optional**, added in v1.6.0 (replaces the old `OPENAI_API_KEY`). An alternate provider for the same Intel insight — set this OR `ANTHROPIC_API_KEY`, not necessarily both; if both are set, Anthropic is used.                                                                                                                                                                                                                                                                                                                             |
| `HDFC_INFINIA_STATEMENT_PASSWORD`        | The password HDFC emails Infinia statement PDFs with                        | **Optional**, added in v1.3.0. Without it, the Imports page still loads, it just can't decrypt a protected PDF and says so rather than crashing. This row was missing from this table until v1.8.0 — see `docs/00-current-state.md` for the correction note.                                                                                                                                                                                                                                                                                 |
| `HDFC_TATA_STATEMENT_PASSWORD`           | The password HDFC emails Tata Neu Plus statement PDFs with                  | **Optional**, added in v1.11.0. Reuses the same `hdfc-infinia-tata` parser module as Infinia above (a real Tata Neu Plus statement reconciled against it with no code changes needed), but kept as its own variable rather than reusing `HDFC_INFINIA_STATEMENT_PASSWORD` — HDFC's co-branded cards aren't guaranteed to share the core product's password formula.                                                                                                                                                                          |
| `AXIS_STATEMENT_PASSWORD`                | The password Axis emails statement PDFs with                                | **Optional**, added in v1.7.0 as `AXIS_HORIZON_STATEMENT_PASSWORD`, renamed in v1.10.0 once a second real statement (an Airtel co-branded Mastercard) confirmed Axis uses the same password scheme for both card products the `axis-horizon-airtel` parser covers — one shared variable, not a per-product one.                                                                                                                                                                                                                              |
| `ICICI_STATEMENT_PASSWORD`               | The password ICICI emails statement PDFs with                               | **Optional**, added in v1.8.0 as `ICICI_AMAZON_STATEMENT_PASSWORD`, renamed in v1.9.0 once a second real statement (a RuPay-variant card) confirmed ICICI uses the same password scheme for both card products the `icici-amazon-rupay` parser covers — one shared variable, not a per-product one.                                                                                                                                                                                                                                          |
| `TELEGRAM_BOT_TOKEN`                     | @BotFather on Telegram, after `/newbot`                                     | **Optional**, added in v3.2.0. Powers calendar-event/trip/recurring-event reminders (the first notification channel). Without it, the reminder toggle still saves on an event, it just never actually sends — see `src/lib/notifications/providers/telegram.ts`. The recipient's own chat ID is entered in the app's Settings page, not here.                                                                                                                                                                                                |
| `CRON_SECRET`                            | Generate yourself: `openssl rand -hex 32`                                   | Added in v3.2.0, the route it authenticates shipped in v3.2.1. **Required in production** once `vercel.json`'s cron entry is live — `/api/cron/reminders` returns `503` on every request until this is set, and `401` for any request whose bearer token doesn't match it. Optional at the env-schema level only so the app still boots in a fresh environment before this is set in Vercel. Vercel automatically sends this value as `Authorization: Bearer $CRON_SECRET` to the route on its schedule (every 4 hours — see `vercel.json`). |
| `AHAANA_ACCESS_PASSWORD`                 | Pick a password just for this — a different one than `APP_ACCESS_PASSWORD`  | Added in v3.4.0. Gates `/ahaana/*` (her own mini app) — a completely separate password from the main app's; knowing one never unlocks the other's section (`src/lib/ahaana-gate.ts`). Optional at the env-schema level, same reasoning as `CRON_SECRET` — until this is set, `/ahaana` just refuses every request rather than the app failing to boot.                                                                                                                                                                                       |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Generate once: `npx web-push generate-vapid-keys`                           | **Optional**, added in v3.4.0 Phase 2 (Ahaana's real device push reminders — she has no Telegram). **Never regenerate once real subscriptions exist** — the public key is baked into each subscription at creation time; a new pair silently breaks every existing one.                                                                                                                                                                                                                                                                      |
| `VAPID_SUBJECT`                          | A project URL, e.g. `https://expdash.vercel.app` — **not** a personal email | **Optional**, added in v3.4.0 Phase 2. The Web Push spec requires a contact URL/mailto in every send; a personal email would be sent to Google/Mozilla/Apple's push infrastructure on every single notification, so this app uses a plain project URL instead.                                                                                                                                                                                                                                                                               |

Every var except `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
`HDFC_INFINIA_STATEMENT_PASSWORD`, `HDFC_TATA_STATEMENT_PASSWORD`,
`AXIS_STATEMENT_PASSWORD`, `ICICI_STATEMENT_PASSWORD`,
`TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `AHAANA_ACCESS_PASSWORD`, and the
three `VAPID_*` vars is required — the app fails
fast (loudly, on startup) if any are missing or malformed, rather than
running with a gap.

**Common mistake when pasting into Vercel's env var UI:** a trailing
space or newline gets included in the value, which silently breaks
validation. If a var that looks correct is still failing, delete it and
retype the value rather than pasting.

### Why there's no real access control

Anyone with the app's URL can see and edit everything — there is no login
of any kind. This was an explicit, deliberate choice for a private
single-user tool, not an oversight. If this URL is ever shared,
indexed, or guessed, there's nothing in the app itself stopping access.
If you want a barrier, add one at the infrastructure level — e.g.
Vercel's Password Protection feature (paid plans) — rather than expecting
the app to provide it.

_(History: an earlier version of this app used per-request Supabase Auth
sign-in with a shared password, meant to feel invisible. It turned out to
be genuinely fragile — concurrent requests from the same device, common
on mobile Safari, could trip Supabase's own sign-in rate limiting and
cause real failures. The current design has no session and no sign-in
call of any kind, which avoids that whole class of problem.)_

## 3. Local development

```bash
npm run dev
```

Visit `http://localhost:3000`. First visit takes you through onboarding
(base currency, timezone) once.

## 4. Deploying to Vercel

1. Push your code to GitHub if you haven't already.
2. In Vercel: **Add New → Project**, import the GitHub repo.
3. Add all four required env vars from the table above (plus
   `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` if you want AI insights) in
   **Project → Settings → Environment Variables** — check all three
   environment boxes (Production, Preview, Development) for each.
4. Deploy (or **Redeploy** if an earlier attempt ran before the env vars
   were set).
5. Open the deployment URL and confirm it loads.

Every git branch you push also gets its own **Preview deployment** at a
separate URL, using the same env vars if you checked that box in step 3.

## Applying a release

Starting with v0.3, Claude delivers releases as a plain zip of the
changed/new files (same folder structure as the repo — extract and
copy over), not a git bundle. Each release's own instructions (below)
tell you exactly which files to add/overwrite and which to delete.

### v0.3 (Milestone 3) — redesign, Intel, rebuilt Budgets

**1. Delete these files/folders first** (they were replaced, not just
edited — copying the new files over old ones would leave orphaned code
otherwise):

```
src/app/(app)/budgets/[budgetId]/          (whole folder)
src/features/budgets/                      (whole folder)
src/services/BudgetService.ts
```

**2. Extract the zip and copy every file it contains into your project,
overwriting anything with the same path.** The zip mirrors the exact
`src/...` paths, so from your project root:

```bash
unzip ~/Downloads/v0.3-release.zip -d /tmp/v0.3-release
cp -r /tmp/v0.3-release/src/* src/
cp /tmp/v0.3-release/tailwind.config.ts .
```

(Adjust the `unzip` source path to wherever the file actually downloaded
— same as any other download, see
[APPLYING-BUNDLES.md](./APPLYING-BUNDLES.md) if you're unsure how to find
that.)

**3. Add the new optional env var** — `ANTHROPIC_API_KEY` (see the table
above). Skip this if you don't want AI insights yet; Intel's charts work
either way.

**4. Verify and commit:**

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
git add -A
git commit -m "v0.3: redesign, Intel, rebuilt Budgets"
git push
```

**5. What changed, if you want to review before committing:** new Intel
tab with real charts and an AI insight; Dashboard rebuilt around account
balances and a new "Upcoming next 3 months" section; Transactions gained
a collapsible card-payment quick-log; Budgets now shows an editable
income/fixed-expense plan instead of the old category-based budgeting
feature (deleted, not hidden — recoverable from git history if you ever
want it back); every screen restyled to the locked design (indigo
gradient headers, rounded cards, sleek icon bottom nav).

## Troubleshooting

### `500: MIDDLEWARE_INVOCATION_FAILED`

Check **Vercel → your project → Deployments → [the failing deployment] →
Runtime Logs** for the actual error — this error code alone doesn't say
why, but the logs always do. Causes seen so far:

- **`Error: Invalid server environment variables: ...`** — one of the
  four env vars is missing or malformed in Vercel. The log names exactly
  which one and why. Fix the value, then redeploy. See the
  trailing-whitespace note above.
- **A Node.js API is used ... not supported in the Edge Runtime** —
  `@supabase/supabase-js` needs Node.js APIs Vercel's default Edge
  sandbox doesn't provide. Already fixed by running middleware on the
  Node.js runtime (`runtime: "nodejs"` in `src/middleware.ts`'s config
  export) — if this resurfaces, something likely removed that setting.

### `Failed to load trips: JWT issued at future` (or the same on calendar events / recurring events / a redirect to onboarding for no reason)

Seen as a real server-side exception on `/calendar`'s very first load
after a stretch of no traffic — the app's own error page ("Application
error: a server-side exception has occurred"), with this exact message
in Vercel's Runtime Logs. Not an actual credential problem:
`SUPABASE_SERVICE_ROLE_KEY` is a long-lived static secret, not something
that expires or gets reissued per request. It's a transient clock-sync
artifact on Supabase's side, and it self-clears — reloading the page
(or waiting for the next request) works. `src/lib/supabase/retry.ts`'s
`withAuthTimingRetry` (added v2.5.3) retries the specific query once,
after a short delay, when it hits this error — applied to `/calendar`'s
server-side data fetches and `middleware.ts`'s `user_settings` check
(the latter matters because, unretried, it silently looked identical to
"no settings row found" and could redirect an already-onboarded owner to
`/onboarding`). If this resurfaces somewhere new, wrap that query the
same way rather than re-solving it from scratch.

### CI failure email from GitHub Actions

This is a different system from your deployed app — it's testing a
throwaway database in GitHub's cloud runners, not your real Supabase
project or your Vercel deployment. Don't treat a CI failure as evidence
of a problem with a live deployment, or vice versa. See
`supabase/tests/README.md` for what the "Migrations + RLS tests" job
covers (note: RLS is no longer the app's actual enforcement mechanism —
see `src/lib/supabase/service.ts` — so that job now mostly documents the
schema's own guarantees rather than what protects live traffic).

### "Invalid login credentials" / sign-in related errors

Not applicable anymore — there is no sign-in flow. If you're seeing
anything mentioning sign-in, magic links, or `APP_OWNER_PASSWORD`,
you're on an old branch from before this architecture changed; pull the
latest.

### Recurring's "Generate due transactions" tagged the wrong cycle (fixed v3.1.2)

Browsing Recurring forward or back with the month-nav and clicking
"Generate due transactions" used to always catch up whatever was due
by _today's real date_, ignoring whichever cycle was actually on
screen — the underlying `generateDueTransactions()` call had no `asOf`
wired up from the UI at all. Fixed in v3.1.2: the button now submits
the viewed `cycleMonth`, and the action scopes catch-up to that
cycle's own window (`cycleWindowEnd`, `lib/dates/month.ts`) instead of
literal today. If you're on an older build and see tagging land in a
cycle other than the one shown, update.

### `/calendar` broke right after deploying v3.2.0 (Failed to load trips/calendar events/recurring calendar events: column ... does not exist)

Deploying v3.2.0's code before applying its migration
(`supabase/migrations/20260822061100_create_notifications.sql`) breaks
`/calendar` immediately — `listCalendarEvents`/`listTrips`/
`listRecurringCalendarEvents` all select the new
`remind_enabled`/`remind_lead_days` columns, which don't exist until
the migration runs. Since `/calendar` is the one gate-free route, this
is a real public-facing outage, not just a broken settings page. Fix:
apply the migration (Supabase dashboard SQL editor, or `supabase db
push`) — no redeploy needed, the running app picks up the new
columns/tables on the very next request. General lesson for any future
migration-plus-code PR: apply the migration first, or expect a window
where the new code is live before the schema is, on any page that
touches the changed tables.

### Telegram "Send test message" → `Bad Request: chat not found`

Two real causes hit while rolling out v3.2.0, in order of how likely
they are:

1. **The bot in the group isn't the one the token belongs to.** Visit
   `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getMe` (your own
   browser, using the exact token set in Vercel) to see which bot that
   token is for, then check the group's member list for that same
   username. A `401 Unauthorized` here means the token itself is bad
   (regenerate it via @BotFather); a `200` with the wrong bot means
   the wrong bot was added to the group.
2. **The chat ID is missing its leading `-`.** A Telegram group's chat
   ID is always negative (e.g. `-4930398936`); a personal DM's is
   positive. The chat-ID field in Settings is a plain text input with
   no numeric sanitization — nothing in the app strips a `-` — so if
   this happens it was dropped when the value was typed/pasted in, not
   a code bug. A basic `"group"`-type chat (not `"supergroup"`) uses
   its id exactly as `getUpdates` reports it, no `-100` prefix needed.

If both check out and the error persists, remove the bot from the
group and re-add it — this forces Telegram to re-register the
bot↔chat relationship — then retry.
