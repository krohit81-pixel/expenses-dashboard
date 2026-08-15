# AI — Intel's Insight, and Merchant Merge Suggestions

> The original target below described a general-purpose, tool-calling
> financial assistant (chat-style Q&A, drafts, audited tool calls). **That
> was never built.** What exists is narrower: two independent,
> button-triggered AI features — Intel's commentary paragraph, and (v2.5.5)
> a merchant-dictionary deduplication assistant on the Merchants page.
> This doc describes both.

## What actually exists

**Intel's insight** (`IntelService.ts`) generates one short (≤2000
character) paragraph summarizing the user's recent spending, stored in
`finance.intel_insights` (one row, overwritten each time) and shown as-is
on the Intel page until the user presses **"Generate commentary"** again
(`IntelService.regenerateInsight`). It is not regenerated on page load —
calling an LLM on every visit was both slow and unnecessary for content
that doesn't need to change more than about once a day.

**Merchant merge suggestions** (`MerchantMergeSuggestionService.ts`,
v2.5.5) address a gap MerchantDictionaryService's own deterministic
resolver openly defers: it only ever matches EXACT alias/name text, so
any statement-text variation (an order-ID suffix, a city name, an
abbreviation) spawns a brand-new "unmapped" merchant rather than being
recognized as one already known — real household feedback after an
import: "I see a lot of unmapped ones present." Pressing **"Find likely
duplicates"** on the Merchants page (`MerchantMergeSuggestions.tsx`)
sends the list of unmapped merchant names and the list of already-
categorized ("established") merchant names to the same configured
provider, asking it to propose which unmapped ones are probably an
established one under different wording. The result is never persisted
and never applied automatically — see "Guardrails" below for why this
is the one place an AI feature's output feeds into something other than
read-only narration, and how it's kept safe anyway.

There is no chat interface, no tool-calling loop, no read/write tool
model, and no per-question Q&A. Intel's charts (by-category,
month-on-month, card-level breakdown) never depend on the AI and work
with zero AI keys configured; the Merchant Dictionary's deterministic
resolver and every manual edit/merge path work the same way.

## Providers

Two optional, mutually-substitutable providers, both configured via
optional env vars (`src/lib/env/server.ts`), **shared by both features**
(v2.5.5 pulled the actual provider calls and the selection order out of
`IntelService.ts` into `lib/ai/providers.ts` — `callConfiguredProvider` —
specifically so a second feature didn't have to re-implement them):

- `ANTHROPIC_API_KEY` (original provider, v0.3)
- `GEMINI_API_KEY` + optional `GEMINI_MODEL` override (added v1.6.0,
  replacing an earlier `OPENAI_API_KEY` option removed at the user's
  request)

If both are set, Anthropic is tried first (arbitrary as a technical
matter, kept for continuity with the household's original setup — see
`callConfiguredProvider`'s own comment). If neither is set, both features
report "no provider configured" rather than crashing the app — every AI
feature here is a pure enhancement on top of a core that works without it.

## Input shape

**Intel's insight** gets the same combined totals the page itself
displays — ledger transactions plus planned/actual credit-card dues
(folded together via `BudgetSnapshotService`, see doc 12's v1.6.3 entry)
— plus a short forward-looking forecast, explicitly steered away from
calling out marginal/noisy month-to-month patterns as significant. No raw
transaction list, account numbers, or attachment content is ever sent —
only the aggregates the page already computed.

**Merchant merge suggestions** get two plain numbered lists of merchant
*display names only* — nothing else about those merchants (no amounts,
no dates, no card numbers, no account info) ever reaches the prompt. The
prompt explicitly instructs the model to skip anything it isn't
confident about and to prefer a missed match over a wrong merge; see
`MerchantMergeSuggestionService.ts`'s own comment for the full prompt and
`parseSuggestions`' defensive handling of malformed/off-instruction
output (any single bad entry is dropped, not the whole batch).

## Guardrails actually enforced

- **Intel's insight is read-only in effect** — narration, never a tool
  call that could write to the ledger.
- **Merchant merge suggestions are advisory only** — the one place an AI
  feature's output feeds into anything beyond pure narration, and
  deliberately kept narrow: the model can only *propose* a candidate
  (unmapped merchant, established merchant) pair. It has no tool-calling
  ability and never calls `mergeMerchants` itself; every suggestion
  requires an explicit human click on a per-row "Merge" button, which
  runs through the exact same `mergeMerchants()` the manual "merge into"
  form (a merchant's own detail page) already used before this feature
  existed. Nothing about the merge *mechanism* changed — only what
  surfaces candidates worth reviewing.
- No secrets, account identifiers, or PII beyond what's already
  aggregated into the page's own numbers (Intel) or plain merchant
  display names (merge suggestions) reach either prompt.
- Optional by design — removing both API keys degrades each feature
  independently, never breaks the app.

## Explicitly not built

Any chat UI, allowlisted read/write tools the model can invoke itself,
per-user rate limiting or spend budgets, audit logging of prompts/tool
calls, a synthetic evaluation set, or the model choosing/assigning a
*category* for a merchant (merge suggestions only ever address merchant
*identity* — "is this the same business as one you already know" — never
what category that business belongs to; a newly-merged transaction still
needs the same manual categorization as any other unmapped merchant). If
a future request needs true Q&A over financial data, or model-driven
category assignment, that's new scope, not an extension of either
existing feature.
