This is Atlas, my personal finance app (Next.js + Supabase, single-owner,
deployed on Vercel). Before doing anything else in this session:

1. Read `docs/00-current-state.md` in full — it's the authoritative,
   kept-current orientation doc: what's actually built, the real auth
   model (single owner, access-gate cookie, service-role Supabase client
   — NOT Supabase Auth/RLS as the live boundary), working conventions
   (the `Money` type, statement-parser module shape, fixture hygiene),
   and its "Working environment" section — verify fresh what this
   session can actually do (file deletion, `git push`, a full `next
   build`) rather than assuming; that section was wrong for a long
   stretch of this app's history (it used to describe sandbox
   restrictions — no deletion, no push, a manual `commit-tree`
   workaround — that turned out not to hold), so don't trust it blindly
   either, confirm against what you actually observe in this session.
2. Skim `docs/README.md` for the rest of the doc map, and read
   `INSTALL.md` at the repo root for actual env vars, setup, and a real
   troubleshooting log.
3. Check `src/lib/version.ts` for the current `APP_VERSION` and `git log
   --oneline -10` for recent history before assuming anything about
   what's already shipped.

Ground rules for this session:

- Never commit real personal data (statement PDFs, extracted statement
  text, real amounts/merchants) into a test fixture, doc, or log. If you
  need to validate a fix against real data I share, use a throwaway
  scratch test, confirm it, then neuter it back to an inert stub before
  committing — same pattern already used throughout this repo's history
  (search for `__scratch-` files for examples).
- Run the verification pipeline before calling anything done:
  `npx tsc --noEmit && npx eslint . && npx prettier --check . && npx vitest run`.
  If a local `npm run build` doesn't complete in-session, say so
  explicitly and fall back to a real Vercel deploy as the build check —
  see below.
- Ship via a feature branch + PR, not a direct commit to `main`:
  `vX.Y.Z: <summary>` commit (or `docs: <summary>`, no version bump, for
  a docs-only change), push, open a PR (`gh` isn't installed in this
  environment — use the GitHub REST API directly, authenticated via
  `git credential fill`; see doc 00's "Working environment" section for
  the exact calls). Ask before merging/deploying unless I've already
  said to — once merged, confirm the deploy yourself
  (`vercel ls`/`vercel inspect`, then `curl` the production URL and
  check for the expected `APP_VERSION`) rather than just telling me to
  check.
- For anything that would trigger a real mutating action or a real paid
  API call (a merge, a transaction write, an LLM call) while verifying a
  change, don't click it for real — use fixture data/obviously-fake IDs
  so it fails harmlessly against Supabase, or skip that specific
  interaction and say so rather than guessing it works. See doc 00's
  fixture-route pattern for testing gated UI this way.
- If something in the numbered docs (01–12) contradicts what you actually
  find in the code, trust the code and `docs/00-current-state.md` — flag
  the doc as needing a follow-up correction rather than assuming the doc
  is right.
- After a change ships, keep the docs in sync — at minimum
  `docs/00-current-state.md`'s relevant section and, for a real bug fix,
  `INSTALL.md`'s troubleshooting log. Don't let this file
  (`NEW_SESSION_PROMPT.md`) go stale either.

Once you've done the above, ask me what I want to work on.
