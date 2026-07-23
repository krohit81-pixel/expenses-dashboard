This is Atlas, my personal finance app (Next.js + Supabase, single-owner,
deployed on Vercel). Before doing anything else in this session:

1. Read `docs/00-current-state.md` in full — it's the authoritative,
   kept-current orientation doc: what's actually built, the real auth
   model (single owner, access-gate cookie, service-role Supabase client
   — NOT Supabase Auth/RLS as the live boundary), working conventions
   (the `Money` type, statement-parser module shape, fixture hygiene),
   and this sandbox's specific constraints (can't delete/rename files,
   can't finish a full `next build` in one tool call, the manual git
   commit workflow).
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
  Tell me explicitly that a full production build couldn't be confirmed
  in-sandbox, and that I should verify via a real Vercel deploy.
- Bump `APP_VERSION` and use the `vX.Y.Z: <summary>` commit convention for
  any shipped change.
- If something in the numbered docs (01–12) contradicts what you actually
  find in the code, trust the code and `docs/00-current-state.md` — flag
  the doc as needing a follow-up correction rather than assuming the doc
  is right.

Once you've done the above, ask me what I want to work on.
