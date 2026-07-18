# Applying code changes from Claude

This replaces an earlier version of this file
(`APPLYING-BUNDLES.md`) that described `.bundle` file delivery — that
method was never actually used in this project's history. Every
release through v0.6.0 was delivered as a **zip file** containing only
the changed files, since the development sessions that built them had
no persistent write access to this GitHub repo. If a session has real
GitHub repo access (via a connector or similar), that changes things —
see the first section below.

## If Claude has direct GitHub repo access

Ask Claude to confirm this explicitly at the start of a session — don't
assume either way. If it does, it can commit and push directly (or open
a PR), and this file's zip-based instructions don't apply. The
verification sequence in `docs/08-engineering-standards.md` still
applies regardless of delivery method — confirm Claude ran it before
trusting a change is complete.

## Zip-file delivery (the method actually used so far)

**1. Download the zip.** Click the download link/attachment in the
chat. It lands wherever your browser saves downloads —
usually `~/Downloads`.

**2. Unzip it and copy the changed files into your local checkout.**
Claude will tell you the exact commands for each release, but the
pattern is always:

```bash
cd expenses-dashboard
unzip ~/Downloads/vX.Y.Z-release.zip -d /tmp/vX.Y.Z-release
cp -r /tmp/vX.Y.Z-release/src/* src/
# if the release includes a migration:
cp -r /tmp/vX.Y.Z-release/supabase/* supabase/
```

The zip only ever contains files that actually changed — copying it
over `src/` won't touch or delete anything else.

**3. Verify locally before committing:**

```bash
rm -rf .next
npm run typecheck
npm run test
npm run build
```

**4. If the release included a migration**, apply it to your real
Supabase project (dashboard SQL editor or `supabase db push`) *before*
deploying the code that depends on it, and run `npm run db:types` to
regenerate `src/lib/db/database-types.ts` for real — releases built
without a live Supabase connection in-session sometimes hand-edited
that file as a documented fallback (see
`docs/02-system-architecture.md`), and it's worth replacing with a real
generated version once you can.

**5. Commit and push:**

```bash
git add -A
git commit -m "vX.Y.Z: <short description Claude gave you>"
git push
```

Vercel deploys automatically from `main`.

## If something's unclear about what changed

Every release commit message in this project's history is written to
explain *why*, not just *what* — several are longer than their diffs.
Read the commit message Claude gives you for the release before
applying it if you want the full reasoning, not just the summary in
chat.
