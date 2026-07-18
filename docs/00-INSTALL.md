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

| Variable                        | Where to find it                                        | Notes                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL         | Safe to expose to the browser                                                                                                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key | Safe to expose to the browser                                                                                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → Project Settings → API → `service_role` key  | **Secret.** This is the ONLY way the app talks to the database — there's no per-visitor session. Never expose to the browser.                                             |
| `APP_OWNER_USER_ID`             | Printed by `npm run bootstrap:owner` (step 1)           | The fixed account every row in the database belongs to.                                                                                                                   |
| `APP_ACCESS_PASSWORD`           | You choose this                                         | **Added in v0.3.2.** The shared password that gates every page except `/calendar`. Pick something real — this is now the actual access barrier, not a placeholder.        |
| `APP_SESSION_SECRET`            | Generate a random 32+ character string                  | **Added in v0.3.2.** Signs the login cookie. Don't reuse a secret from anywhere else — e.g. `openssl rand -hex 32` locally, or any password manager's "generate" feature. |
| `ANTHROPIC_API_KEY`             | console.anthropic.com → API Keys                        | **Optional.** Powers Intel's AI insight only. If unset, Intel's charts still work — the insight card just shows a "not available" message.                                |

Every var except `ANTHROPIC_API_KEY` is required — the app fails fast
(loudly, on startup) if any are missing or malformed, rather than
running with a gap.

**Common mistake when pasting into Vercel's env var UI:** a trailing
space or newline gets included in the value, which silently breaks
validation. If a var that looks correct is still failing, delete it and
retype the value rather than pasting.

### Who can see what

As of v0.3.2, this is no longer "anyone with the URL sees everything."
**`/calendar` is public** — no password needed, safe to share the link
with anyone. **Everything else requires the shared password** you set
as `APP_ACCESS_PASSWORD` above, entered once per browser at `/login`
(a cookie remembers it for 30 days after that). There's a "Log out of
this device" action in More if you ever need to test the login flow
again or revoke access from a specific browser.

This still isn't real multi-user authentication — it's one shared
password gating one shared account, appropriate for a household tool,
not a public product. Treat `APP_ACCESS_PASSWORD` like a real password:
don't reuse one from elsewhere, and remember that anyone who knows it
(or can read/set env vars in your Vercel project) can see all your
financial data.

_(History: an earlier version of this app used per-request Supabase Auth
sign-in with a shared password, meant to feel invisible. It turned out to
be genuinely fragile — concurrent requests from the same device, common
on mobile Safari, could trip Supabase's own sign-in rate limiting and
cause real failures. Then, for a while, there was no login at all. The
current gate (v0.3.2) is a third design: a real password barrier again,
but a simple self-contained signed cookie instead of a Supabase Auth
session — no external call on login, so no rate limit to trip.)_

## 3. Local development

```bash
npm run dev
```

Visit `http://localhost:3000`. First visit takes you through onboarding
(base currency, timezone) once.

## 4. Deploying to Vercel

1. Push your code to GitHub if you haven't already.
2. In Vercel: **Add New → Project**, import the GitHub repo.
3. Add all six required env vars from the table above (plus
   `ANTHROPIC_API_KEY` if you want AI insights) in **Project → Settings →
   Environment Variables** — check all three environment boxes
   (Production, Preview, Development) for each.
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
[APPLYING-CHANGES.md](./APPLYING-CHANGES.md) if you're unsure how to find
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

### v0.3.2 — supersedes v0.3.1, bug fixes + Calendar + password gate

**This release replaces v0.3.1 entirely — apply this one, not that one,
even if you haven't applied v0.3.1 yet.** It contains everything from
v0.3.1 (the desktop nav fix) plus several rounds of real bug fixes found
from actual usage, plus two new features.

**No files to delete.** Extract and copy every file the zip contains
into your project, overwriting anything with the same path:

```bash
unzip ~/Downloads/v0.3.2-release.zip -d /tmp/v0.3.2-release
cp -r /tmp/v0.3.2-release/src/* src/
cp /tmp/v0.3.2-release/INSTALL.md .
```

**Two new required env vars** — `APP_ACCESS_PASSWORD` and
`APP_SESSION_SECRET` (see the table above). The app will fail to start
without them, by design — same fail-fast behavior as every other
required var.

**Verify and commit:**

```bash
npm install
rm -rf .next
npm run typecheck
npm run lint
npm run test
npm run build
git add -A
git commit -m "v0.3.2: Calendar, password gate, bug fixes"
git push
```

**What's actually in this release:**

- Fixed: desktop navigation was completely missing on 5+ pages (Accounts,
  Recurring, Net worth, Settings, More) — a real regression from v0.3
  where moving the nav into each page's Hero component meant pages
  without a Hero had no way to navigate away on desktop.
- Fixed: several forms used unconditional 2-3 column grids that
  overlapped on narrow phone screens — the card-payment picker and four
  other forms across Accounts/Transactions/Recurring/Net Worth now
  stack properly on mobile.
- Fixed: the bottom nav didn't leave enough clearance for its own height
  plus the iPhone home-indicator safe area, overlapping page content.
- Hardened: the gradient header and both nav bars now read colors
  directly from CSS variables instead of through Tailwind's theme
  config layer, for resilience against config drift.
- New: **Calendar** replaces Budgets as a primary tab. Budgets still
  exists, just moved into More. Calendar is public — see
  [Who can see what](#who-can-see-what) above.
- New: a real password gate for everything except Calendar — also see
  [Who can see what](#who-can-see-what).

**If colors still don't render correctly after this release**, that's a
separate, unresolved issue from before this release — not something
fixed here. Two theories (a stale/mismatched `tailwind.config.ts`, and a
stale Vercel build cache) were tested directly and both ruled out. If
you still see it, that needs fresh investigation with real deployment
logs, not another guess — flag it again with specifics if it persists.

## Troubleshooting

### `Cannot find module '.../page.js'` from `npm run typecheck`

Happens after a release deletes a page/route (like v0.3 deleting
`budgets/[budgetId]`) — Next.js caches generated type stubs in `.next/`
that don't get cleaned up automatically when a source file disappears.
Fix:

```bash
rm -rf .next
npm run typecheck
```

Safe to run any time something looks stale after applying a release —
`.next` is a build cache, not a real part of the project; deleting it
just means the next build takes a little longer.

### `500: MIDDLEWARE_INVOCATION_FAILED`

Check **Vercel → your project → Deployments → [the failing deployment] →
Runtime Logs** for the actual error — this error code alone doesn't say
why, but the logs always do. Causes seen so far:

- **`Error: Invalid server environment variables: ...`** — one of the
  six env vars is missing or malformed in Vercel. The log names exactly
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
