# Security and Privacy

## Threat model

The highest-value assets are transaction history, account identities, receipts, import files, service keys, and the ability to write ledger data. Primary threats include cross-user data exposure, leaked keys, malicious uploads, import duplication, compromised sessions, and prompt-injection attempts through imported text.

## Access control

- Require Supabase Auth for all app routes and commands.
- Enable RLS on every `finance` table and use `auth.uid() = user_id` policies.
- Retain ownership triggers for all cross-table references; RLS alone does not enforce relationship ownership.
- Store the service-role key only in server deployment secrets. Mark service modules server-only and prevent their import into client bundles.
- Use signed, short-lived URLs for private attachment upload/download. Do not make the finance bucket public.

## Data handling

- Use TLS in transit and Supabase encryption at rest.
- Minimize collection: do not collect bank credentials, full account numbers, or attachments unless needed.
- Redact sensitive values in logs, analytics, error reports, and AI traces.
- Define retention and deletion behavior for imports, attachments, conversations, and closed accounts. Support account export and deletion requests.

## Input and upload protection

- Apply Zod validation and server-side authorization to every command.
- Limit file size, MIME type, extension, parser execution time, row count, and decompression ratio.
- Scan attachments where operationally feasible; never render untrusted HTML or SVG inline.
- Treat CSV cells and bank descriptions as untrusted input in UI, logs, and AI prompts.

## Operational safeguards

- Rotate secrets and revoke exposed keys promptly.
- Enable MFA for project administrators and least-privilege team roles.
- Pin dependencies through the lockfile and scan them in CI.
- Rate-limit authentication-adjacent and import/assistant endpoints.
- Maintain an incident runbook for data exposure, erroneous import, malicious upload, and migration failure.
