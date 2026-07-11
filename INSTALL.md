# Install & Setup

One-stop guide for getting this app running, both locally and on Vercel.
If something breaks, check [Troubleshooting](#troubleshooting) first — it
covers every error this project has actually hit so far.

## Prerequisites

- Node.js 20+
- A Supabase project with the `finance` schema migrated in (see
  `supabase/migrations/`) and exposed in the project's API settings
- A Vercel account, for deployment

## 1. Environment variables

Every one of these is required — the app deliberately fails fast (loudly,
on startup) if any are missing or malformed, rather than running with a
gap. Copy `.env.example` to `.env.local` for local dev, and set the same
five in Vercel (Project → Settings → Environment Variables).

| Variable                        | Where to find it                                        | Notes                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL         | Safe to expose to the browser                                                                                                                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key | Safe to expose to the browser                                                                                                                                               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → Project Settings → API → `service_role` key  | **Secret.** Bypasses RLS. Never expose to the browser.                                                                                                                      |
| `APP_OWNER_EMAIL`               | You choose this                                         | Must be a valid **email shape** (e.g. `owner@example.com`) — it never actually receives mail, it's just an identifier. See [No visible sign-in](#no-visible-sign-in) below. |
| `APP_OWNER_PASSWORD`            | You choose this                                         | A long, random, unique password (12+ characters). This is the real access barrier for the whole app — see below.                                                            |

**Common mistake when pasting into Vercel's env var UI:** a trailing space
or newline gets included in the value, which silently breaks validation
(e.g. `APP_OWNER_EMAIL` failing "must be a valid email address" even
though it looks fine at a glance). If a var that looks correct is still
failing validation, delete it and retype the value rather than pasting.

### No visible sign-in

This app has no login screen. Every visitor is automatically signed in as
one fixed "owner" Supabase Auth account — see `src/middleware.ts`. The
first request after a fresh deploy creates that account automatically
using `APP_OWNER_EMAIL`/`APP_OWNER_PASSWORD`; after that it just signs in
silently on every request.

This means **`APP_OWNER_PASSWORD` is the entire access barrier** for the
app, not a convenience setting — anyone who knows it (or can read/set env
vars in your Vercel project) can see all your financial data. Treat it
like a real password: generate it with a password manager, don't reuse
one from elsewhere, don't put it in a place anyone else can read.

## 2. Local development

```bash
npm install
cp .env.example .env.local   # then fill in the five variables above
npm run dev
```

Visit `http://localhost:3000`. First visit creates the owner account (if
it doesn't exist yet) and takes you through onboarding (base currency,
timezone) once.

## 3. Deploying to Vercel

1. Push your code to GitHub if you haven't already.
2. In Vercel: **Add New → Project**, import the GitHub repo.
3. Before or immediately after the first deploy, add all five env vars
   from the table above in **Project → Settings → Environment Variables**
   — check all three environment boxes (Production, Preview, Development)
   for each.
4. Deploy (or **Redeploy** if the first attempt ran before the env vars
   were set — a deploy that predates the env vars will keep failing until
   you trigger a new one).
5. Open the deployment URL and confirm it loads.

That's it — there's no Supabase Auth redirect URL to register anymore
(that was only needed for the email magic-link flow, which this app no
longer uses).

Every git branch you push also gets its own **Preview deployment** at a
separate URL. Preview deployments use the same env vars as Production
(if you checked that box in step 3), so they should work the same way.

## Troubleshooting

### `500: MIDDLEWARE_INVOCATION_FAILED`

Middleware is throwing on every request. Check **Vercel → your project →
Deployments → [the failing deployment] → Runtime Logs** for the actual
error — this error code alone doesn't say why, but the logs always do.
Two causes seen so far:

- **`Error: Invalid server environment variables: ...`** — one of the
  five env vars is missing or malformed in Vercel. The log names exactly
  which one and why (e.g. "APP_OWNER_EMAIL must be a valid email
  address"). Fix the value in Vercel → Settings → Environment Variables,
  then redeploy. See the trailing-space note above — this is the most
  common cause of a var that "looks right" still failing.
- **A Node.js API is used ... not supported in the Edge Runtime** — a
  dependency (originally `@supabase/supabase-js`) used a Node.js API
  Vercel's default Edge sandbox doesn't support. Already fixed by running
  middleware on the Node.js runtime (`runtime: "nodejs"` in
  `src/middleware.ts`'s config) — if this resurfaces, it likely means a
  new dependency was added to middleware that also needs Node APIs, or
  the runtime config was accidentally removed.

### CI failure email from GitHub Actions

This is a different system from your deployed app — it's testing a
throwaway database in GitHub's cloud runners, not your real Supabase
project or your Vercel deployment. Don't treat a CI failure as evidence
of a problem with a live deployment, or vice versa; check each
independently. See `supabase/tests/README.md` for what the "Migrations +
RLS tests" job actually covers.

### Sign-in link never arrives / magic link flow

Not applicable anymore — see [No visible sign-in](#no-visible-sign-in).
If you're seeing this, you're likely on an older branch before that
change landed.
