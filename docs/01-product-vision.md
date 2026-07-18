# Product Vision

## What Atlas is

Atlas is a private, single-owner personal finance workspace — not a
budgeting app in the traditional "set a limit per category" sense, and
not a ledger app in the "record everything that happened" sense either.
It's built around one specific mental model: **a personal cash-flow
operating system**, organized by monthly financial cycles rather than
by transaction history.

The core belief driving every design decision so far: most personal
finance apps answer "what did I spend?" Atlas is built to answer "will
I be okay?" — forward-looking, cycle-aware, and tolerant of incomplete
data (an untagged transaction doesn't corrupt a number, it's just
absent until tagged).

## Who this is for

One person (or one household sharing a single login), not a multi-tenant
product. There is no sign-up flow, no per-user data isolation, and no
plan to add either — see `docs/11-security-and-privacy.md` for exactly
what that does and doesn't mean for safety. If this product direction
ever changes to serve multiple independent users, that's a fundamental
re-architecture (real auth, real RLS, tenant isolation everywhere), not
an incremental feature — flag it explicitly before starting, don't
assume the existing single-owner patterns extend naturally.

## The core mental model: Financial Cycle → Phase

This is the single most important concept to understand before touching
Home, Budgets, or the cycle-tagging system. Get this wrong and nothing
else makes sense.

**A "cycle" is a calendar month** — July, August, September. Each cycle
has its own three-phase lifecycle:

| Phase | When (relative to the cycle) | Question it answers |
|---|---|---|
| Planning | 15th–24th of the *previous* month | "Will this month be financially healthy?" |
| Execution | 25th of the *previous* month through the 5th of *this* month | "What still needs to be completed?" |
| Tracking | 6th–14th of *this* month | "Has anything changed my forecast?" |

So "August's Planning" happens July 15–24. "August's Execution" happens
July 25–August 5 (salary lands ~25th, gets used to pay bills due
1st–5th). "August's Tracking" happens August 6–14.

**Which phase a given cycle defaults to, relative to today**, follows a
rule derived from three worked examples (see
`src/lib/dates/phase.ts` and its tests for the exact logic and the
examples it was checked against):

- The **current calendar month** mirrors whatever phase is globally
  active right now — *except* Planning, which is inherently about next
  month, so the current month falls back to Tracking (its settled
  state) instead of showing Planning about itself.
- **Any future month** defaults to Planning — hasn't started yet.
- **Any past month** is locked to Tracking — nothing left to plan or
  execute, only review.

This is enforced two ways in code: `defaultPhaseForMonth` picks the
*default* tab when a cycle is first selected, and `phaseAvailability`
enforces which tabs are even *selectable* for that cycle (past = 
Tracking only, future = Planning only, current = all three). Home's
cycle dropdown (`src/features/home/HomePhaseView.tsx`) lets a person
browse any cycle in a fetched window and always shows that cycle's own
correct phase options — a bug fixed mid-build was showing a phase's
date range anchored to *today* regardless of which cycle was selected;
`getPhaseInfoForCycle` fixed this by anchoring to the *selected* cycle
instead.

## Cycle-tagging: the second core mechanic

Every transaction can carry a `cycle_month` tag (e.g. `"2026-08"`),
independent of `occurred_on` (the literal date money moves). A card
payment made July 30th can be tagged to August's cycle if that's
conceptually what it's for.

**The rule that makes this useful: untagged = excluded.** Recurring
templates (`recurring_transactions`) are reference data now, not an
auto-projection source. A template contributes to a month's numbers
*only* if a real transaction exists, linked to that template
(`recurring_transaction_id`) and tagged to that month
(`cycle_month`). Nothing appears automatically. This was a deliberate
pivot away from an earlier version where every active recurring
template auto-projected into every month it would naturally recur —
that made "what's actually confirmed for this month" impossible to
distinguish from "what usually happens." See
`src/services/BudgetSnapshotService.ts` for the implementation and its
own comments for the fuller reasoning.

Defaults exist so this doesn't create friction for someone who doesn't
think about cycles at all: `createTransaction` defaults an omitted
`cycleMonth` to `occurredOn`'s own month;
`generateDueTransactions` (the recurring catch-up job) tags
auto-generated transactions to their natural occurrence month. Explicit
tagging is for when the two diverge — reviewing next month's cash flow
before it arrives.

## What's explicitly out of scope right now

- **Multi-user / household sharing.** Single owner only, by design, not
  by oversight.
- **An AI assistant / chat-based financial Q&A.** Never built, not on
  the current roadmap. `docs/07-ai-assistant.md` exists as a stub
  documenting that this was considered and deliberately deferred, not
  as a spec to implement from.
- **Statement/CSV import.** `/imports` is a placeholder page. Not
  started.
- **Investment tracking.** `securities` and `investment_transactions`
  tables exist in the schema from an early migration but have zero
  code referencing them — nothing reads or writes to them. Don't build
  a feature assuming they're wired up; they aren't.
- **Brokerage execution, payment initiation, tax filing, credit
  decisions.** Never in scope.

## Product principles, as actually practiced this far

- **Reasoning before code.** The phase-boundary rule above wasn't
  designed top-down — it was derived from three concrete worked
  examples the person gave, verified against all three in tests before
  any UI was touched. When a request is ambiguous about *behavior*
  (not just UI), work out the rule with examples before writing code.
- **Untagged/unconfirmed data is absent, not wrong.** The whole
  cycle-tagging model depends on this: a month with nothing tagged
  shows "nothing tagged yet," not a zero that looks like a real
  answer.
- **Read-only vs. actionable is a real distinction, not just a
  permission check.** Only the Execution tab, for the actual current
  month, lets you mark things paid/unpaid. Every other view of the
  same data (Planning's preview, Tracking's review, any past month) is
  presentation-only. This was tightened mid-build after real confusion
  about why a read-only-feeling summary had live checkboxes.
- **Money is never a JS float.** See `docs/08-engineering-standards.md`.
- **Every release ships fully verified** — see
  `docs/09-testing-strategy.md`'s "what verification actually means
  here" section. This has been non-negotiable across every change made
  so far, including tiny ones.
