# AI Assistant

## Status: not built, not currently planned

No chat interface, no tool-calling against financial data, no
grounded-Q&A feature exists in this app. This document is a stub
recording that state accurately, replacing an earlier speculative spec
written before the product's actual direction (the Financial Cycle →
Phase model — see `docs/01-product-vision.md`) existed.

If this gets revisited, the design questions worth starting from are
different than a generic "AI assistant" spec would suggest, because
this app already has a specific, carefully-derived mental model an
assistant would need to respect rather than reinvent:

- An assistant answering "how am I doing this month" needs to
  understand that untagged data is *absent*, not zero — a wrong answer
  here isn't a hallucination in the usual sense, it's treating missing
  data as if it were a confirmed number.
- Any assistant action that *writes* data (tagging a transaction to a
  cycle, marking something paid) needs to go through the same
  Server Actions the UI uses (`docs/04-api-design.md`), not a parallel
  write path — otherwise `revalidatePath` calls and validation get
  bypassed.
- The single-owner, no-per-user-auth model (`docs/02-system-architecture.md`)
  means there's no "which user is asking" ambiguity to design around,
  but also no natural boundary to restrict what an assistant can see —
  worth deciding deliberately rather than by default.

Not a spec to build from — a note for whoever picks this up next that
the obvious generic approach may not fit this app's actual model.
