# Product Vision

## Purpose

Build a private, trustworthy personal finance workspace that makes a person's financial position understandable and actionable without requiring spreadsheet maintenance. The product should feel calm and accurate: an owner can see cash flow, spending, commitments, net worth, and upcoming decisions in a few moments.

## Target users

- Individuals or households who manage several bank, cash, credit-card, loan, and investment accounts.
- People who want to import statements but retain a final human review step.
- Users who want help finding patterns without giving an assistant authority to move money or silently edit history.

## Primary jobs

1. Record, import, classify, and reconcile financial activity.
2. Understand income, expenses, budgets, debt, assets, and net worth over time.
3. Plan recurring commitments and identify upcoming cash needs.
4. Store receipts and supporting documents with the related financial record.
5. Ask grounded questions about personal data and receive explainable answers.

## Product boundaries

In scope: single-user financial management first, optional household sharing later, imported statements, manual entries, planning, and analysis.

Out of scope for the first releases: brokerage execution, payment initiation, investment advice, tax filing, credit decisions, and autonomous money movement. The assistant may summarize and suggest, but never executes irreversible actions without a reviewed command.

## Success metrics

- A new user can create an account, import a statement, review classifications, and see an accurate monthly cash-flow view in under 15 minutes.
- At least 95% of imported rows are either automatically matched with high confidence or presented with a clear review reason.
- Every visible balance is traceable to included accounts and transactions.
- No user can retrieve another user's data through the app, API, attachment URLs, or assistant context.
- Core dashboard load meets the performance budgets in the deployment document on a mid-tier iPhone.

## Product principles

- Accuracy over visual novelty.
- Reviewable automation over opaque automation.
- Financial terminology is precise, but the interface is plain-language.
- Sensitive defaults: private storage, least privilege, and short-lived access.
