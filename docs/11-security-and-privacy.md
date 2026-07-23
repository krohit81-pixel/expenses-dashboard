# Security and Privacy

> The original threat model below assumed live Supabase Auth + RLS as the
> enforcement boundary. **That is not how this app actually works** — see
> [00 — Current state](./00-current-state.md) for the full explanation.
> This doc is corrected to describe the real model. `INSTALL.md`'s
> "Why there's no real access control" section is the canonical statement
> of this design choice and its accepted risk — read that first.

## The real access model

- **No Supabase Auth sign-in.** One fixed owner `auth.users` row
  (`APP_OWNER_USER_ID` / `OWNER_USER_ID`), created once via
  `npm run bootstrap:owner`. Every request that reaches past the access
  gate runs as this account, unconditionally.
- **App-level access gate**, not Supabase Auth: an HMAC-signed cookie
  (`src/lib/access-gate.ts`), set once per browser after entering
  `APP_ACCESS_PASSWORD`, enforced in `src/middleware.ts` for every route
  except `/calendar` (deliberately public/shareable, no financial data).
  Chosen specifically because the earlier per-request
  `signInWithPassword` design tripped Supabase's own sign-in rate limiting
  under concurrent mobile-Safari requests — a real production failure
  mode, not a hypothetical one.
- **Service-role Supabase client for everything**
  (`src/lib/supabase/service.ts`) — bypasses RLS entirely. RLS policies
  and ownership triggers are still present and correct in the schema, but
  provide **no actual isolation today** since there's only one owner and
  no per-request session to scope against. Every service is individually
  responsible for filtering by `OWNER_USER_ID`.
- **Practical consequence**: anyone who reaches the app's URL and knows
  `APP_ACCESS_PASSWORD` (or already has the cookie) sees and can edit
  everything. This is an accepted, explicit tradeoff for a private
  single-user tool, not an oversight — if the URL is ever shared, indexed,
  or guessed, there is nothing else in the app stopping access. A real
  additional barrier (e.g. Vercel's Password Protection) would need to be
  added at the infrastructure level, not the app level.

## What's still worth enforcing, and why

- Keep writing RLS policies and `assert_reference_owner`-style ownership
  triggers on new tables anyway — they document the intended per-user
  boundary and would matter again immediately if this app ever became
  genuinely multi-user. Don't treat them as dead weight to skip.
- Keep the service-role key and any AI provider keys server-only
  (`server-only` import) — a leaked service-role key or API key is still
  a real, current risk even with a single owner, since it grants full
  database or paid-API access to whoever has it.
- Statement PDFs and their passwords are real personal financial
  documents — never let extracted statement text or a password end up in
  a committed test fixture, log line, or doc (see doc 08/09's fixture
  hygiene rule).

## Data handling (unchanged in principle)

- TLS in transit, Supabase encryption at rest.
- Minimize collection — don't store more of a statement's content than
  the parser actually needs as structured fields; `raw_text` per
  transaction is kept specifically to diagnose parsing misses, not as a
  general audit log.
- Treat statement text, descriptions, and merchant names as untrusted
  input in UI, logs, and any AI prompt (Intel's insight — see doc 07 for
  what is and isn't sent to a provider).

## Input and upload protection

- Statement PDFs: password-protected decryption via `pdfjs-dist`, with
  distinct, explicit error types for "password required" vs. "password
  incorrect" vs. "couldn't parse the layout" vs. "didn't reconcile" —
  surfaced to the user with a specific message rather than a generic
  failure.
- No general file-size/MIME/row-count/decompression-ratio hardening has
  been built beyond what's needed for the statement-import path
  specifically — revisit if a more general upload surface is ever added.

## Operational safeguards

Rotate the service-role key and any AI provider key promptly if exposed.
Pin dependencies via the lockfile. The single biggest realistic risk
today is the access-gate password itself leaking or the URL becoming
guessable/indexed — treat that as the primary thing to protect, ahead of
anything schema-level.
