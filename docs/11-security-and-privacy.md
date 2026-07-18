# Security and Privacy

## The actual threat model

This is a single-owner app with no per-user data isolation to
enforce — there's only one real user. The thing actually being
protected against is **an uninvited person reaching the app's URL and
seeing financial data**, not one legitimate user seeing another's data
(that scenario doesn't exist here). Read this document with that in
mind — a lot of "standard" web-app security advice (RLS per user,
session-fixation prevention across accounts, etc.) doesn't apply
because the underlying premise (multiple distinct users) isn't true of
this app.

## Access control, precisely

A single shared password (`APP_ACCESS_PASSWORD`), checked once per
browser via an HMAC-signed cookie
(`src/lib/access-gate.ts`/`src/lib/access-gate-core.ts`, 30-day
expiry). `src/middleware.ts` enforces this on every route except
`/calendar` and `/login`. There is no Supabase Auth session involved in
this gate at all — see `docs/02-system-architecture.md` for why an
earlier version that did use Supabase Auth's sign-in endpoint broke
under mobile Safari's request prefetching.

**`/calendar` is deliberately public**, meant to be shareable (e.g.
with family) without exposing financial data. It shows school/
university calendar information only — no account balances, no
transactions. If you're asked to add anything to `/calendar`, confirm
it doesn't leak financial data before adding it, since this route
bypasses the password gate entirely by design.

## Data access pattern

Every server-side Supabase call uses the **service-role client**
(`src/lib/supabase/service.ts`), which bypasses Row Level Security.
RLS policies exist in the migrations (inherited from an earlier,
more ambitious multi-tenant design) but are not part of this app's
actual protection — nothing in the real request path is subject to
them, since nothing uses the anon/authenticated client for finance
data. The service-role key is never sent to the browser. If a future
change introduces a code path where the browser talks to Supabase
directly, that's the point to actually think hard about RLS — right
now it's dormant, not load-bearing.

## Secrets

Six required env vars (`docs/10-deployment-and-operations.md`),
managed via Vercel's environment variable configuration in production
and `.env.local` (gitignored) locally. `APP_SESSION_SECRET` signs the
access-gate cookie — rotating it invalidates every existing session,
forcing re-entry of the password everywhere.

## What this app does not attempt to defend against

Given the single-owner model: no protection against one authenticated user
accessing another's data (no "another user" exists), no rate-limiting
on the access-gate password beyond what Vercel/the platform provides by
default, no audit log of who accessed what (there's only one "who").
If the product ever moves toward multiple genuinely distinct users,
every one of these needs real design work — that's a different
security posture entirely, not an extension of the current one.

## Attachments

Stored in a private Supabase Storage bucket
(`20260710000200_create_finance_attachment_bucket.sql`). Downloads go
through the one real API route
(`src/app/api/attachments/[attachmentId]/download/route.ts`), which
generates a signed, time-limited URL rather than exposing a permanent
public link.
