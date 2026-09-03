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
Vercel (see step 3). This `APP_OWNER_USER_ID` is a one-time setup value,
not something anyone ever signs in with — the app's actual password
barrier is `APP_ACCESS_PASSWORD`, set separately (see the env var table
below, and "The access model" section further down).

**Don't run this script more than once per Supabase project.** If you
accidentally do, or need the ID again later, find the user in Supabase →
Authentication → Users and copy their ID from there instead.

## 2. Environment variables

| Variable                                 | Where to find it                                                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`               | Supabase → Project Settings → API → Project URL                             | Safe to expose to the browser                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`          | Supabase → Project Settings → API → `anon` `public` key                     | Safe to expose to the browser                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`              | Supabase → Project Settings → API → `service_role` key                      | **Secret.** This is now the ONLY way the app talks to the database — there's no session-based access anymore. Never expose to the browser.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `APP_OWNER_USER_ID`                      | Printed by `npm run bootstrap:owner` (step 1)                               | The fixed account every row in the database belongs to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `APP_ACCESS_PASSWORD`                    | Pick a password yourself                                                    | **Required.** The app's real access barrier — see "The access model" below. Not tied to Supabase Auth in any way; just a password checked against this value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `APP_SESSION_SECRET`                     | Generate yourself: `openssl rand -hex 32`                                   | **Required, secret.** Signs the access-gate cookie so it can't be forged. At least 32 characters — don't reuse another secret for this.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ANTHROPIC_API_KEY`                      | console.anthropic.com → API Keys                                            | **Optional**, added in v0.3. Powers Intel's AI insight only. If unset, Intel's charts still work — the insight card just shows a "not available" message.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `GEMINI_API_KEY`                         | aistudio.google.com → Get API Key                                           | **Optional**, added in v1.6.0 (replaces the old `OPENAI_API_KEY`). An alternate provider for the same Intel insight — set this OR `ANTHROPIC_API_KEY`, not necessarily both; if both are set, Anthropic is used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `GEMINI_MODEL`                           | See aistudio.google.com's model list                                        | **Optional.** Overrides the default Gemini model (`gemini-2.5-flash`) used when `GEMINI_API_KEY` is set. Only needed if that default is ever deprecated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `HDFC_INFINIA_STATEMENT_PASSWORD`        | The password HDFC emails Infinia statement PDFs with                        | **Optional**, added in v1.3.0. Without it, the Imports page still loads, it just can't decrypt a protected PDF and says so rather than crashing. This row was missing from this table until v1.8.0 — see `docs/00-current-state.md` for the correction note.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `HDFC_TATA_STATEMENT_PASSWORD`           | The password HDFC emails Tata Neu Plus statement PDFs with                  | **Optional**, added in v1.11.0. Reuses the same `hdfc-infinia-tata` parser module as Infinia above (a real Tata Neu Plus statement reconciled against it with no code changes needed), but kept as its own variable rather than reusing `HDFC_INFINIA_STATEMENT_PASSWORD` — HDFC's co-branded cards aren't guaranteed to share the core product's password formula.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `AXIS_STATEMENT_PASSWORD`                | The password Axis emails statement PDFs with                                | **Optional**, added in v1.7.0 as `AXIS_HORIZON_STATEMENT_PASSWORD`, renamed in v1.10.0 once a second real statement (an Airtel co-branded Mastercard) confirmed Axis uses the same password scheme for both card products the `axis-horizon-airtel` parser covers — one shared variable, not a per-product one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ICICI_STATEMENT_PASSWORD`               | The password ICICI emails statement PDFs with                               | **Optional**, added in v1.8.0 as `ICICI_AMAZON_STATEMENT_PASSWORD`, renamed in v1.9.0 once a second real statement (a RuPay-variant card) confirmed ICICI uses the same password scheme for both card products the `icici-amazon-rupay` parser covers — one shared variable, not a per-product one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `TELEGRAM_BOT_TOKEN`                     | @BotFather on Telegram, after `/newbot`                                     | **Optional**, added in v3.2.0. Powers calendar-event/trip/recurring-event reminders (the first notification channel). Without it, the reminder toggle still saves on an event, it just never actually sends — see `src/lib/notifications/providers/telegram.ts`. The recipient's own chat ID is entered in the app's Settings page, not here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `CRON_SECRET`                            | Generate yourself: `openssl rand -hex 32`                                   | Added in v3.2.0, the route it authenticates shipped in v3.2.1. **Required in production** — every `/api/cron/*` route returns `503` until this is set, and `401` for any request whose bearer token doesn't match it. Optional at the env-schema level only so the app still boots in a fresh environment before this is set. As of v3.6.9, only `/api/cron/ahaana-weekly-report` (weekly) still runs on Vercel's own cron feature (`vercel.json`, sends `Authorization: Bearer $CRON_SECRET` automatically) — the three more-frequent routes (`reminders` every 4h, `reminders-hourly` and `ahaana-reminders` every 15min) run on GitHub Actions instead, since Vercel's Hobby plan caps its own cron feature to once a day. Those workflows (`.github/workflows/cron-*.yml`) need this **same value** added as a **GitHub repository secret** also named `CRON_SECRET` (Settings → Secrets and variables → Actions) — they send the identical bearer header by hand. |
| `AHAANA_ACCESS_PASSWORD`                 | Pick a password just for this — a different one than `APP_ACCESS_PASSWORD`  | Added in v3.4.0. Gates `/ahaana/*` (her own mini app) — a completely separate password from the main app's; knowing one never unlocks the other's section (`src/lib/ahaana-gate.ts`). Optional at the env-schema level, same reasoning as `CRON_SECRET` — until this is set, `/ahaana` just refuses every request rather than the app failing to boot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Generate once: `npx web-push generate-vapid-keys`                           | **Optional**, added in v3.4.0 Phase 2 (Ahaana's real device push reminders — she has no Telegram). **Never regenerate once real subscriptions exist** — the public key is baked into each subscription at creation time; a new pair silently breaks every existing one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `VAPID_SUBJECT`                          | A project URL, e.g. `https://expdash.vercel.app` — **not** a personal email | **Optional**, added in v3.4.0 Phase 2. The Web Push spec requires a contact URL/mailto in every send; a personal email would be sent to Google/Mozilla/Apple's push infrastructure on every single notification, so this app uses a plain project URL instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `AHAANA_SCHOOL_EMAIL`                    | Her school Outlook address, e.g. `ahaana.kohli@cns.ac.in`                   | **Optional**, added in v3.4.12 (the "Connect School Email" proof of concept on `/ahaana-progress`). Deliberately the simplest possible connection — IMAP against `outlook.office365.com` with a plain email + password, no OAuth, no app registration. See `src/lib/microsoft/imap-client.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `AHAANA_SCHOOL_EMAIL_PASSWORD`           | Her actual school account password                                          | **Secret.** Same v3.4.12 feature as above. Never exposed to the browser — only ever read server-side. **Real caveat**: Microsoft retired plain username+password IMAP access for most Exchange Online tenants back in October 2022. Whether this actually works at all depends entirely on whether the school's own tenant is one of the shrinking minority that still permits it — there's no code-side fix if it's disabled, and it's only knowable by actually trying it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Every var except `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
`HDFC_INFINIA_STATEMENT_PASSWORD`, `HDFC_TATA_STATEMENT_PASSWORD`,
`AXIS_STATEMENT_PASSWORD`, `ICICI_STATEMENT_PASSWORD`,
`TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `AHAANA_ACCESS_PASSWORD`, the
three `VAPID_*` vars, and the two `AHAANA_SCHOOL_EMAIL*` vars is
required — the app fails fast (loudly, on startup) if any are missing
or malformed, rather than running with a gap. That includes
`APP_ACCESS_PASSWORD` and `APP_SESSION_SECRET` — the app won't boot
without a real access barrier configured.

**Common mistake when pasting into Vercel's env var UI:** a trailing
space or newline gets included in the value, which silently breaks
validation. If a var that looks correct is still failing, delete it and
retype the value rather than pasting.

### The access model

**This section used to say there's no login at all — that stopped being
true and this file wasn't updated when it changed. Corrected here.**

There **is** a real password barrier: `APP_ACCESS_PASSWORD`. Every route
except `/calendar` and `/api/calendar.ics` (deliberately public — see
below) requires it once per browser, enforced in `src/middleware.ts` via
an HMAC-signed cookie
(`APP_SESSION_SECRET` signs it, so it can't be forged without that
secret). This is **not** Supabase Auth — there's no session, no sign-in
API call, nothing tied to `auth.users` at request time. It's just a
shared password checked against `APP_ACCESS_PASSWORD` and a cookie that
proves you passed that check. See `docs/00-current-state.md`'s "Auth
model" section for the full picture, including why Supabase Auth itself
isn't the live enforcement boundary (RLS is bypassed by the service-role
client every service uses — see that same section).

`/calendar` (and, since v3.6.4, its `/api/calendar.ics` iCal feed — see
doc 00's v3.6.4 section) are the deliberate exceptions — public and
shareable without a password, so it's safe to send either link to
anyone, but nothing financial lives there (just the shared family
calendar and travel dates). If either URL is ever shared, indexed, or
guessed, that data (and only that data) is visible with no barrier — a
conscious tradeoff, not an oversight. `/api/calendar.ics` has to be
public for a real reason, not just consistency: a calendar app's
background refresh has no way to carry the access-gate cookie at all.

Ahaana's mini app (`/ahaana/*`) has its own, completely separate
password (`AHAANA_ACCESS_PASSWORD`) — knowing one password never
unlocks the other's section.

_(History: an even earlier version of this app had genuinely no access
control at all — "anyone with the URL can see and edit everything," by
deliberate choice for a then-truly-private tool. Before that, a version
before **that** used per-request Supabase Auth sign-in with a shared
password, meant to feel invisible; that turned out to be genuinely
fragile — concurrent requests from the same device, common on mobile
Safari, could trip Supabase's own sign-in rate limiting and cause real
failures. The current `APP_ACCESS_PASSWORD` cookie-gate design has no
session and no sign-in API call of any kind, avoiding that whole class
of problem, while still requiring a real password to get in.)_

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

**This section used to describe an old zip-file delivery mechanism
(pre-v1.0) and linked to a file (`APPLYING-BUNDLES.md`) that no longer
exists in this repo — both stale for a long time. Corrected here.**

Releases ship as plain git commits directly to `main` — no zip files,
no manual file copying. `main` is connected to Vercel, so a push there
auto-deploys. The actual per-release workflow:

1. Claude runs the full verification pipeline before committing:
   `npx tsc --noEmit && npx eslint . && npx prettier --check . && npx
vitest run`, then `npm run build`.
2. Commits with a `vX.Y.Z: <summary>` message (`git log --oneline` is
   the real release history — read it directly rather than looking for
   a separate changelog file) and pushes to `main`.
3. **If the release includes a new file under `supabase/migrations/`,
   that migration needs to be applied to the real Supabase project
   yourself** — Supabase dashboard → SQL Editor, paste the new file's
   contents, run it — Claude doesn't have a live connection to your
   Supabase project in most sessions (no `supabase` CLI login) and
   can't apply it directly. No redeploy needed afterward; the running
   app picks up new columns/tables on its very next request. Applying
   it _before_ the code that depends on it deploys is safest — see
   "`/calendar` broke right after deploying v3.2.0" below for exactly
   what goes wrong if the order is reversed.
4. `docs/00-current-state.md` gets a new version section describing
   what shipped — that file (not this one, and not the numbered
   docs under `docs/`) is the real, kept-current changelog.

## Troubleshooting

### `500: MIDDLEWARE_INVOCATION_FAILED`

Check **Vercel → your project → Deployments → [the failing deployment] →
Runtime Logs** for the actual error — this error code alone doesn't say
why, but the logs always do. Causes seen so far:

- **`Error: Invalid server environment variables: ...`** — one of the
  four _required_ env vars (`SUPABASE_SERVICE_ROLE_KEY`,
  `APP_OWNER_USER_ID`, `APP_ACCESS_PASSWORD`, `APP_SESSION_SECRET` —
  everything else in the table above is optional) is missing or
  malformed in Vercel. The log names exactly which one and why. Fix
  the value, then redeploy. See the trailing-whitespace note above.
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
