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

| Variable                          | Where to find it                                         | Notes                                                                                                                                                                                                                                                        |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`        | Supabase → Project Settings → API → Project URL          | Safe to expose to the browser                                                                                                                                                                                                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Supabase → Project Settings → API → `anon` `public` key  | Safe to expose to the browser                                                                                                                                                                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`       | Supabase → Project Settings → API → `service_role` key   | **Secret.** This is now the ONLY way the app talks to the database — there's no session-based access anymore. Never expose to the browser.                                                                                                                   |
| `APP_OWNER_USER_ID`               | Printed by `npm run bootstrap:owner` (step 1)            | The fixed account every row in the database belongs to.                                                                                                                                                                                                      |
| `ANTHROPIC_API_KEY`               | console.anthropic.com → API Keys                         | **Optional**, added in v0.3. Powers Intel's AI insight only. If unset, Intel's charts still work — the insight card just shows a "not available" message.                                                                                                    |
| `GEMINI_API_KEY`                  | aistudio.google.com → Get API Key                        | **Optional**, added in v1.6.0 (replaces the old `OPENAI_API_KEY`). An alternate provider for the same Intel insight — set this OR `ANTHROPIC_API_KEY`, not necessarily both; if both are set, Anthropic is used.                                             |
| `HDFC_INFINIA_STATEMENT_PASSWORD` | The password HDFC emails Infinia statement PDFs with     | **Optional**, added in v1.3.0. Without it, the Imports page still loads, it just can't decrypt a protected PDF and says so rather than crashing. This row was missing from this table until v1.8.0 — see `docs/00-current-state.md` for the correction note. |
| `AXIS_HORIZON_STATEMENT_PASSWORD` | The password Axis emails Horizon statement PDFs with     | **Optional**, added in v1.7.0. Same reasoning as `HDFC_INFINIA_STATEMENT_PASSWORD` above — a separate variable since the two banks' password schemes have no reason to match.                                                                                |
| `ICICI_AMAZON_STATEMENT_PASSWORD` | The password ICICI emails Amazon Pay statement PDFs with | **Optional**, added in v1.8.0. Same reasoning again — the one real sample statement this parser was built against wasn't password-protected, but ICICI does encrypt these in production.                                                                     |

Every var except `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
`HDFC_INFINIA_STATEMENT_PASSWORD`, `AXIS_HORIZON_STATEMENT_PASSWORD`, and
`ICICI_AMAZON_STATEMENT_PASSWORD` is required — the app fails fast
(loudly, on startup) if any are missing or malformed, rather than running
with a gap.

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
