# Deployment and Operations

## Environments

Maintain local, preview, staging, and production environments. Each uses a separate Supabase project or an equally isolated database and Storage bucket. Vitals is production unless explicitly designated otherwise; never use it for exploratory migration testing.

## CI/CD sequence

1. Install locked dependencies.
2. Run formatting, typecheck, lint, unit, and component tests.
3. Start disposable Supabase, apply migrations, generate schema types, and run database integration tests.
4. Build Next.js and run end-to-end tests against preview.
5. Require approval for production migrations and deployment.
6. Apply migrations before application code that depends on them; deploy backward-compatible code first when a staged rollout is needed.

## Supabase migration operations

Use the CLI from a clean checkout. Check remote migration history, run pending migrations on staging, inspect logs, then apply production migrations. Migrations are forward-only. For risky changes, take a backup, create a restore rehearsal, and schedule a maintenance window if a lock is possible.

## Observability

Capture structured server logs with request ID, user pseudonym or hash, route, duration, error code, and job/import ID. Track dashboard latency, command error rate, import parse/commit rate, queue delay, storage errors, AI tool failures, and database slow queries. Never log raw financial rows, tokens, credentials, or attachment content.

## Reliability and backup

Enable Supabase backups/PITR appropriate to the plan. Verify restore procedures quarterly. Attachments require a separate inventory and restore check because database backups do not replace object-storage recovery. Queue work must be idempotent and retry with bounded exponential backoff.

## Performance budgets

- Initial app route server response: p95 below 500ms excluding a cold start.
- Dashboard interactive readiness on a representative iPhone: p75 below 3s on a normal mobile connection.
- Common transaction list queries: p95 below 300ms for a year of one user's data.
- Imports: asynchronous progress; no request held open for file parsing.
