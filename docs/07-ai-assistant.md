# AI — Intel's Insight

> The original target below described a general-purpose, tool-calling
> financial assistant (chat-style Q&A, drafts, audited tool calls). **That
> was never built.** What exists is much narrower: a single,
> button-triggered AI-generated commentary paragraph on the Intel page.
> This doc describes that.

## What actually exists

`IntelService.ts` generates one short (≤2000 character) insight paragraph
summarizing the user's recent spending, stored in `finance.intel_insights`
(one row, overwritten each time) and shown as-is on the Intel page until
the user presses **"Generate commentary"** again
(`IntelService.regenerateInsight`). It is not regenerated on page load —
calling an LLM on every visit was both slow and unnecessary for content
that doesn't need to change more than about once a day.

There is no chat interface, no tool-calling loop, no read/write tool
model, and no per-question Q&A. The AI's only job is to narrate the
numbers the Intel page's charts already computed deterministically —
the charts themselves (by-category, month-on-month, card-level breakdown)
never depend on the AI and work with zero AI keys configured.

## Providers

Two optional, mutually-substitutable providers, both configured via
optional env vars (`src/lib/env/server.ts`):

- `ANTHROPIC_API_KEY` (original provider, v0.3)
- `GEMINI_API_KEY` + optional `GEMINI_MODEL` override (added v1.6.0,
  replacing an earlier `OPENAI_API_KEY` option removed at the user's
  request)

If both are set, Anthropic is tried first (see `regenerateInsight`'s own
comment for the exact fallback order). If neither is set, the button
reports "no provider configured" rather than crashing the app — Intel's
charts are the core dependency, the AI insight is a pure enhancement.

## Input shape

The prompt includes the same combined totals the page itself displays —
ledger transactions plus planned/actual credit-card dues (folded together
via `BudgetSnapshotService`, see doc 12's v1.6.3 entry) — plus a short
forward-looking forecast, explicitly steered away from calling out
marginal/noisy month-to-month patterns as significant. No raw transaction
list, account numbers, or attachment content is ever sent — only the
aggregates the page already computed.

## Guardrails actually enforced

- Read-only in effect: the insight is narration, never a tool call that
  could write to the ledger.
- No secrets, account identifiers, or PII beyond what's already aggregated
  into the page's own numbers reach the prompt.
- Optional by design — removing both API keys degrades the feature, never
  breaks the app.

## Explicitly not built

Any chat UI, allowlisted read/write tools, per-user rate limiting or spend
budgets, audit logging of prompts/tool calls, a synthetic evaluation set,
or draft-transaction/categorization proposals from the model. If a future
request needs true Q&A over financial data, that's new scope, not an
extension of `IntelService`.
