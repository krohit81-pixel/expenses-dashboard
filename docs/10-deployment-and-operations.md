# Deployment and Operations

> The original multi-environment (local/preview/staging/production, each
> its own Supabase project) target below was never built out. **Root
> `INSTALL.md` is the actual, maintained source of truth for setup,
> environment variables, deployment, and a running troubleshooting log of
> real production errors** — read that, not this section, for anything
> operational. This doc covers what still holds plus Cowork-sandbox-
> specific notes for whoever (human or agent) is working in this repo.

## Actual environment model

One Supabase project, one Vercel project. Every git branch pushed to
GitHub gets its own Vercel Preview deployment automatically, sharing the
same env vars if configured for all environments. There is no separate
staging Supabase project — migrations are applied directly via the
Supabase CLI/dashboard against the one project. Treat this project as
production: no exploratory migration testing against it.

## Release process (as actually practiced)

1. Make the change; run the verification pipeline (doc 08/09).
2. Bump `APP_VERSION` in `src/lib/version.ts`.
3. Commit as `vX.Y.Z: <summary>` with a detailed body explaining the
   "why" (this repo's convention — see `git log` for the standard).
4. User pushes and Vercel deploys automatically (or via their own trigger).
5. User confirms the real deploy — see "Sandbox build limitation" below
   for why an agent working in this sandbox cannot confirm a production
   build itself.

## Sandbox build limitation

Inside a Cowork session, `npm run build` (a full Next.js production
build) reliably cannot finish within a single tool call's timeout, and
background (`nohup`/`setsid`/`disown`) attempts get killed once the tool
call's shell exits. **Never claim a build passed based on sandbox
output.** Instead: run `tsc --noEmit`, `eslint .`, `prettier --check .`,
and `vitest run` (this catches the large majority of real issues,
including most RSC/server-action mistakes via `eslint-config-next`), and
explicitly tell the user to confirm with a real Vercel deploy before
trusting the change is fully safe.

## Sandbox git workflow

The sandbox's `.git` directory can't always be updated by a plain
`git commit` (object cleanup during ordinary git operations sometimes hits
filesystem permission errors — see below). The working pattern used
throughout this repo's Cowork-driven history:

```bash
TMP_INDEX=$(mktemp)
export GIT_INDEX_FILE="$TMP_INDEX"
git read-tree HEAD
git add <specific files>          # stage deliberately, never `git add -A`
TREE=$(git write-tree)
PARENT=$(git rev-parse HEAD)
export GIT_AUTHOR_NAME="Atlas Delivery" GIT_AUTHOR_EMAIL="atlas-bot@local"
export GIT_COMMITTER_NAME="Atlas Delivery" GIT_COMMITTER_EMAIL="atlas-bot@local"
SHA=$(git commit-tree "$TREE" -p "$PARENT" -F <commit-message-file>)
echo "$SHA" > .git/refs/heads/main
cp "$TMP_INDEX" .git/index
```

This workflow doesn't push — tell the user to `git push` themselves.
`Operation not permitted` warnings from `git`'s own loose-object cleanup
during these commands are expected and harmless (the commit still
succeeds); they're a symptom of the same filesystem restriction described
next.

## Sandbox filesystem limitation: no delete/rename

Files cannot be deleted, unlinked, or renamed in this sandbox (`rm`,
`fs.unlinkSync`, etc. fail with `EPERM`) — and because the user's real
project folder is bind-mounted directly into the sandbox (not a separate
clone), this is a real constraint, not a permissions quirk to work around
with `sudo`. Workarounds actually used in this repo's history:

- To retire a file's content: overwrite it (e.g. a scratch test neutered
  to `describe.skip`).
- To "rename" a directory: create the new one with the desired content,
  then `git rm --cached -r --ignore-unmatch <old-path>` to stop tracking
  the old one without needing a physical delete — `git show --stat` still
  shows this as a clean rename. The old files remain as physical,
  untracked cruft (e.g. `src/services/statement-parsers/axis-atlas/`,
  `extract-scratch.mjs`, `extract3.mjs`, `docs/commit-msg-v1.5.0.txt`) —
  tell the user to delete these by hand; they cannot be cleaned up from
  within a Cowork session.

## Observability and reliability

No structured logging/observability pipeline or automated backup
verification has been built beyond what Supabase and Vercel provide by
default. This is a single-owner personal tool, not a multi-tenant SaaS —
revisit this section if that ever changes.
