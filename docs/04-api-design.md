# API Design

## API posture

Expose a small BFF contract from Next.js. The web client should not encode business workflows as multi-table Supabase calls. Reads may use typed Supabase queries where RLS is sufficient; all stateful workflows pass through a service with Zod validation and a single transaction or RPC.

## Conventions

- Base path: `/api/v1` for route handlers intended as stable HTTP APIs.
- IDs: UUIDs. Dates: ISO `YYYY-MM-DD`. Timestamps: ISO-8601 UTC.
- Amounts: decimal strings such as `"1250.00"`, never JSON numbers.
- Errors: `{ "error": { "code", "message", "fieldErrors?", "requestId" } }`.
- Mutations require an idempotency key for imports, scheduled work, and retryable user actions.
- Pagination uses cursor plus limit. All list endpoints accept an explicit date range where applicable.

## Initial endpoint surface

| Area | Read | Command |
| --- | --- | --- |
| Dashboard | `GET /dashboard?from&to` | None |
| Accounts | `GET /accounts`, `GET /accounts/:id` | `POST /accounts`, `PATCH /accounts/:id`, archive command |
| Transactions | `GET /transactions` | create, update, void, transfer, reconcile commands |
| Categories | `GET /categories` | create, update, archive |
| Budgets | `GET /budgets/:period` | create budget, set line, close period |
| Imports | `GET /imports/:id` | create upload, parse, review, commit, discard |
| Attachments | metadata reads | create signed upload, finalize, create signed download |
| Assistant | conversation reads | submit prompt, approve action |

## Example command

```json
POST /api/v1/transactions
{
  "accountId": "uuid",
  "kind": "expense",
  "amount": "42.50",
  "currencyCode": "USD",
  "occurredOn": "2026-07-10",
  "payee": "Grocer",
  "splits": [{ "categoryId": "uuid", "amount": "42.50" }]
}
```

The service validates the request, confirms account and categories are owned by the session user, validates split totals, writes the header and splits atomically, and returns a typed DTO. Do not expose raw database rows as a long-term API contract.

## Server-side database access

- Session-scoped calls use the user token and RLS.
- Trusted service operations use the service-role client only inside server-only modules.
- Multi-step writes use a database RPC or a service transaction where the database client supports it. Validation must be repeated at the database layer for high-risk invariants.
- Never accept `user_id` from a browser command. Infer it from the authenticated session.

## Error classes

- `400`: malformed request or failed Zod validation.
- `401`: no valid session.
- `403`: session is valid but ownership or role check fails.
- `404`: record not found within the caller's visible scope.
- `409`: idempotency conflict, duplicate import, or stale reconciliation state.
- `422`: valid structure but invalid financial invariant.
- `429`: rate limit exceeded.
