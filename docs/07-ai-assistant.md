# AI Assistant Design

## Role

The assistant helps the owner understand and organize their finance data. It is not a financial adviser, transaction executor, or background agent with unrestricted database access.

## Capabilities

- Answer bounded questions such as monthly spending changes, upcoming recurring payments, category anomalies, and budget progress.
- Draft categorization or transaction-edit proposals with cited records.
- Explain reports and identify missing or inconsistent data.
- Create only reversible drafts by default.

## Tool model

The model does not query the database directly. The server offers typed, allowlisted tools that each enforce session ownership, date-range limits, result limits, and audit logging.

| Tool | Permission | Example |
| --- | --- | --- |
| `get_cash_flow` | Read | Summarize income and expenses for a period. |
| `search_transactions` | Read | Find matching transactions within a bounded range. |
| `get_budget_status` | Read | Explain category spend against plan. |
| `draft_categorization` | Draft | Propose category changes; no persistence. |
| `create_transaction_draft` | Draft | Prepare an unposted manual entry. |

Write tools require a clear confirmation screen with the exact records and changes. Do not provide tools for deletion, payment initiation, credential access, or service-role operations.

## Context minimization

Send only the minimum data needed to answer the question. Prefer aggregates and redacted labels to full raw transaction history. Attachments, account numbers, authentication tokens, and user secrets are never model context. Persist only conversation data that has a defined retention purpose.

## Guardrails

- System instructions forbid financial, tax, or legal conclusions presented as professional advice.
- Tool results are treated as untrusted structured inputs and schema-validated before the model sees them.
- Responses that contain numbers cite the period and records used.
- Rate-limit per user and enforce spend budgets.
- Audit prompt metadata, tool invocation, result count, confirmation, model version, and cost; avoid storing raw sensitive prompts unless opted in.

## Evaluation

Maintain a synthetic, de-identified evaluation set for calculation accuracy, ownership isolation, refusal behavior, prompt injection resistance, and correct use of confirmation. Ship assistant changes only after tool-call and numerical-answer regression tests pass.
