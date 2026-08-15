"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatMoneyDisplay } from "@/lib/money";
import {
  importStatementAction,
  type ImportStatementState,
} from "@/features/imports/api/actions";
import { CARD_STATEMENT_LABELS } from "@/features/imports/cards";
import { LogCardDuePrompt } from "@/features/imports/components/LogCardDuePrompt";
import { MerchantMergeSuggestions } from "@/features/merchants/components/MerchantMergeSuggestions";
import type { Account } from "@/services/AccountService";

const CARD_OPTIONS = Object.entries(CARD_STATEMENT_LABELS);

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatIsoDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

/**
 * Phase 2: upload a statement PDF and it's parsed, reconciled, and
 * saved automatically — no separate review/confirm step. A summary of
 * what got saved is shown immediately after; the raw extracted text
 * (Phase 1's whole UI) is still available underneath, collapsed, since
 * it's the most useful thing to check against if a parse or
 * reconciliation error comes back.
 *
 * v2.5.4: a successful (or duplicate) save now also renders
 * LogCardDuePrompt, pre-filled from the parsed header — see that
 * component's own comment for why the import itself was never enough
 * to make an imported statement show up as a Dashboard expense.
 *
 * v2.5.6: when this import created any new ("needs review") merchants,
 * also renders MerchantMergeSuggestions right here — the same
 * AI-assisted duplicate-check tool that lives on /merchants, so
 * checking for a near-duplicate of a merchant this import just created
 * (an order-ID suffix, a city name — anything the deterministic
 * alias/name matcher can't catch) is the very next thing offered,
 * instead of requiring a separate trip to /merchants. It still checks
 * the whole dictionary's backlog, not just this import's merchants —
 * there's no per-import scoping, deliberately: one shared tool, reused
 * in both places, rather than a second scoped variant to maintain.
 */
export function StatementUploadForm({
  cardAccounts,
  checkingAccounts,
}: {
  cardAccounts: Account[];
  checkingAccounts: Account[];
}) {
  const [card, setCard] = useState(CARD_OPTIONS[0][0]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<ImportStatementState>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setIsSubmitting(true);
    setState({});
    try {
      const next = await importStatementAction(state, formData);
      setState(next);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="import-card">Card</Label>
          <select
            id="import-card"
            name="card"
            value={card}
            onChange={(event) => setCard(event.target.value)}
            className="h-11 w-full rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm text-ink"
          >
            {CARD_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="import-file">Statement PDF</Label>
          <input
            id="import-file"
            name="file"
            type="file"
            accept="application/pdf"
            onChange={(event) =>
              setFileName(event.target.files?.[0]?.name ?? null)
            }
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:font-display file:text-xs file:font-bold file:text-accent"
          />
          {fileName && (
            <p className="text-xs text-ink-faint">Selected: {fileName}</p>
          )}
        </div>

        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? "Reading & saving…" : "Upload statement"}
        </Button>
      </form>

      {state.error && (
        <p className="rounded-xl bg-negative-soft px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      )}

      {state.summary && (
        <div className="space-y-2 rounded-xl bg-positive-soft px-4 py-3 text-sm text-ink">
          <p className="font-display text-xs font-bold text-positive">
            {state.status === "duplicate"
              ? "Already imported — no changes made"
              : `Saved — ${state.summary.transactionCount} transaction${state.summary.transactionCount === 1 ? "" : "s"} imported`}
          </p>
          {state.status === "saved" && state.summary.needsReviewCount > 0 && (
            <p className="text-xs text-ink-soft">
              {state.summary.needsReviewCount} new merchant
              {state.summary.needsReviewCount === 1 ? "" : "s"} need a category
              —{" "}
              <Link
                href="/merchants?filter=uncategorized"
                className="font-semibold underline"
              >
                review now
              </Link>
              .
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-soft">
            <dt className="text-ink-faint">Card</dt>
            <dd>
              {state.summary.issuer} {state.summary.cardType} ••••{" "}
              {state.summary.cardLast4}
            </dd>
            <dt className="text-ink-faint">Cardholder</dt>
            <dd>{state.summary.primaryCardholder}</dd>
            <dt className="text-ink-faint">Statement date</dt>
            <dd>{formatIsoDate(state.summary.statementDate)}</dd>
            <dt className="text-ink-faint">Due date</dt>
            <dd>{formatIsoDate(state.summary.dueDate)}</dd>
            <dt className="text-ink-faint">Total amount due</dt>
            <dd>
              {formatMoneyDisplay(
                state.summary.totalAmountDue,
                state.summary.statementCurrency,
              )}
            </dd>
            <dt className="text-ink-faint">Minimum due</dt>
            <dd>
              {formatMoneyDisplay(
                state.summary.minimumDue,
                state.summary.statementCurrency,
              )}
            </dd>
          </dl>
        </div>
      )}

      {state.summary && (
        <LogCardDuePrompt
          key={`${state.summary.cardSource}-${state.summary.statementDate}-${state.summary.cardLast4}`}
          cardSource={state.summary.cardSource}
          cycleMonth={state.summary.cycleMonth}
          dueDate={state.summary.dueDate}
          totalAmountDue={state.summary.totalAmountDue}
          statementCurrency={state.summary.statementCurrency}
          alreadyLoggedCardAccountIds={
            state.summary.alreadyLoggedCardAccountIds
          }
          cardAccounts={cardAccounts}
          checkingAccounts={checkingAccounts}
        />
      )}

      {state.summary && state.summary.needsReviewCount > 0 && (
        <MerchantMergeSuggestions />
      )}

      {state.pages && (
        <details className="rounded-xl border-[1.5px] border-line bg-surface">
          <summary className="cursor-pointer px-3 py-2 font-display text-xs font-bold text-ink">
            Extracted text ({state.pages.length}{" "}
            {state.pages.length === 1 ? "page" : "pages"})
          </summary>
          <div className="space-y-2 px-3 pb-3">
            <p className="text-xs text-ink-faint">
              Exactly what was read from the PDF, for double-checking against
              the real statement if something above looks wrong.
            </p>
            {state.pages.map((page) => (
              <details
                key={page.pageNumber}
                className="rounded-xl border-[1.5px] border-line bg-surface"
              >
                <summary className="cursor-pointer px-3 py-2 font-display text-xs font-bold text-ink">
                  Page {page.pageNumber}
                </summary>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 font-mono text-[11px] leading-relaxed text-ink-soft">
                  {page.text || "(no text found on this page)"}
                </pre>
              </details>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
