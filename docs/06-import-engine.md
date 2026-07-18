# Import Engine

## Status: not built

`/imports` (`src/app/(app)/imports/page.tsx`) is a placeholder route.
No parsing, matching, deduplication, or commit flow exists. There is an
`attachments` table and working attachment upload/download
(`AttachmentService`, the one real API route for signed download URLs)
— attaching a receipt or statement *file* to an existing record works
today, but nothing reads the contents of that file to create
transactions from it.

## Before building this

This document intentionally doesn't contain a detailed spec — an
earlier version did, written before the actual product direction (the
Financial Cycle → Phase model, cycle-tagging) existed, and it no longer
reflects what an import feature would need to integrate with. Any real
design here needs to answer, specifically:

- **How does an imported transaction get a `cycle_month`?** Given
  "untagged = excluded" is the whole point of the current model (see
  `docs/01-product-vision.md`), a bulk import that leaves everything
  untagged would be invisible everywhere until manually tagged one by
  one — probably not the intended UX for importing dozens of rows at
  once. Does import need a bulk-tag-to-cycle step? A smarter default
  than `occurred_on`'s own month?
- **Does it create `recurring_transactions` from repeated patterns, or
  only ad-hoc `transactions`?** The current recurring-templates model
  is explicitly "reference data you tag from," not
  auto-detected — importing shouldn't silently create templates unless
  that's a deliberate design decision, discussed and confirmed first.
- **Where does review/dedup happen relative to the existing
  `TransactionRow` edit/delete/void UI?** Reusing that instead of
  building a separate review surface is worth considering before
  building something new.

Treat this as a real product design conversation to have before
writing code, not a backlog item to pick up and implement directly from
a spec that doesn't exist yet.
