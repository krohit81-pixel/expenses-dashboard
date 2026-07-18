# Deployment and Operations

## Environments

One production environment. One Supabase project ("Vitals"). One
Vercel deployment. There is no staging/preview Supabase project and no
formal staged-rollout process — this reflects the project's actual
scale (single owner, personal use), not an oversight. If usage ever
grows to justify a staging environment, that's worth setting up
deliberately rather than assumed to already exist.

## Required environment variables

Six, all required for the app to boot (env validation fails fast on
anything missing):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_OWNER_USER_ID
APP_ACCESS_PASSWORD
APP_SESSION_SECRET
```

See `INSTALL.md` in the repo root for the full one-time setup sequence
(`npm run bootstrap:owner`, Vercel env var configuration, etc.) — that
file is kept accurate and current; this doc doesn't duplicate its
step-by-step instructions.

For local builds/CI runs without a real Supabase project, placeholder
values are used (see `.github/workflows/ci.yml`'s `build` job for the
exact placeholder set) — this proves the build is structurally sound,
not that it works against real data.

## CI/CD, as actually configured

`.github/workflows/ci.yml`, four jobs:

1. **`static-checks`** — format:check, typecheck, lint, unit tests. No
   Docker needed.
2. **`database-tests`** — starts a disposable local Supabase stack via
   the CLI, applies every migration in `supabase/migrations/`, runs
   `npm run test:db` (RLS/integrity tests) against it. Never touches
   the real Vitals project.
3. **`build`** — confirms `next build` succeeds, using placeholder env
   vars. Depends on `static-checks` passing first.
4. **`types-drift-check`** — informational only (`continue-on-error:
   true`). Diffs the committed `database-types.ts` against what
   `supabase gen types` would produce for the applied migrations.
   Doesn't block merges — see `docs/08-engineering-standards.md`'s note
   on why a hand-edited types file currently exists for one migration.

Deployment itself is Vercel's standard git-push-triggers-deploy flow —
no separate deploy step in this CI config; Vercel handles it
independently once code lands on `main`.

## Applying migrations

Migrations are forward-only — never edit an applied one, write a
corrective migration instead. Apply to the real Vitals project via the
Supabase CLI or dashboard SQL editor. There's no automated
migration-application step in CI/CD; this is a manual step taken
deliberately, given the small scale and the value of a human confirming
a schema change before it hits the one real database this app has.

## How code has actually been delivered to the repo, historically

Development sessions on this project frequently had **no direct git
push access and no persistent connection to this GitHub repo** — work
happened in an isolated sandbox, verified fully (per
`docs/09-testing-strategy.md`), then packaged as a zip of only the
changed files, for the person to manually `cp` into their local
checkout and commit themselves. Release notes in commit messages from
that era are unusually detailed for exactly this reason — the person
applying the change wasn't the one who wrote it, so the reasoning
needed to travel with the diff.

**If a session has real GitHub repo access** (via a connector or
similar), that changes the mechanics — direct commits/PRs become
possible instead of zip delivery — but the verification discipline
(`docs/08-engineering-standards.md`'s full sequence, run and passing,
before anything is proposed as done) does not relax just because
delivery got easier. Confirm what access you actually have at the
start of a session rather than assuming either mode.

## Observability

None currently instrumented — no structured logging, no error
tracking service, no performance monitoring beyond whatever Vercel's
default dashboard provides. Worth adding if usage or reliability
concerns grow; not present today.

## Backups

Whatever Supabase's plan-level default provides. No documented restore
rehearsal process, no separate attachment-storage backup verification.
Given the single-owner scale, this is a real gap worth closing before
this app holds data the person would be upset to lose, not before —
flag it rather than assume enterprise-grade backup posture exists.
